<script>
   import { untrack } from 'svelte'
   import Avatar from './Avatar.svelte'
   import { domain } from '../scripts/Pocketbase.svelte'

   let {
      gameState,
      socketId,
      socket,
      activeMessages,
      eloResults = [],
      handleSubmitWord,
      handleSubmitPrefix,
      handleTyping,
      handleSendMessage,
      handleUseSkill,
      handleTogglePause,
      showError,
      onLeaveRoom,
   } = $props()

   let wordInput = $state('')
   let chatInput = $state('')
   let isScrambled = $state(false)
   let scramblePending = $state(false)
   let previousTurn = $state(false)
   let activeEmotes = $state({})
   let chatHistory = $state([])
   let showRetireModal = $state(false)
   let showCorrectAnim = $state(false)
   let showErrorAnim = $state(false)
   let prevWordCount = $state(0)
   let typingWordOverride = $state(null)
   let lastServerTypingWord = $state('')

   let spectators = $derived(
      gameState.players?.filter((p) => p.lives <= 0 || p.isSpectator) || []
   )
   let circlePlayers = $derived(
      gameState.players?.filter((p) => !p.isSpectator && p.lives > 0) || []
   )
   let activePlayer = $derived(gameState.players?.[gameState.currentTurnIndex])

   let isMyTurn = $derived(
      gameState.settings?.teamMode && gameState.settings?.teamMode !== 'ffa'
         ? me?.team === gameState.currentTeamTurn && gameState.teamLives?.[me?.team] > 0
         : activePlayer?.id === socketId
   )

   let isMyChoice = $derived(gameState.choosingPlayerId === socketId)
   let me = $derived(gameState.players?.find((p) => p.id === socketId))
   let sortedPlayers = $derived(
      [...(gameState.players || [])].sort((a, b) => b.score - a.score)
   )

   let isSpectator = $derived(me?.isSpectator || false)
   let isBusyPlaying = $derived(
      (isMyTurn && gameState.status === 'playing') ||
         (isMyChoice && gameState.status === 'choosing_prefix')
   )

   let eloBySocket = $derived(
      Object.fromEntries((eloResults || []).map((r) => [r.socketId, r]))
   )

   let effectiveTypingWord = $derived(
      typingWordOverride !== null ? typingWordOverride : gameState.currentTypingWord || ''
   )

   let currentRotation = $state(0)
   let prevTurnIndex = $state(0)

   $effect(() => {
      const activeIdx = gameState.currentTurnIndex
      const totalPlayers = circlePlayers.length
      if (activeIdx !== prevTurnIndex && totalPlayers > 0) {
         let diff = activeIdx - prevTurnIndex
         if (diff > totalPlayers / 2) diff -= totalPlayers
         if (diff < -totalPlayers / 2) diff += totalPlayers
         currentRotation -= diff * (360 / totalPlayers)
         prevTurnIndex = activeIdx
      }
   })

   $effect(() => {
      const turnTrackToken =
         gameState.settings?.teamMode && gameState.settings?.teamMode !== 'ffa'
            ? gameState.currentTeamTurn
            : gameState.currentTurnIndex
      untrack(() => {
         if (!isMyTurn) {
            wordInput = ''
            if (handleTyping) handleTyping('')
         }
      })
   })

   $effect(() => {
      const serverWord = gameState.currentTypingWord || ''
      untrack(() => {
         if (serverWord !== lastServerTypingWord) {
            lastServerTypingWord = serverWord
            typingWordOverride = null
         }
      })
   })

   let lastTurnToken = $state('')
   $effect(() => {
      const currentTurnToken =
         gameState.settings?.teamMode && gameState.settings?.teamMode !== 'ffa'
            ? gameState.currentTeamTurn
            : String(gameState.currentTurnIndex)
      if (currentTurnToken !== lastTurnToken) {
         lastTurnToken = currentTurnToken
         untrack(() => {
            typingWordOverride = ''
         })
      }
   })

   $effect(() => {
      if (gameState.status === 'playing') {
         setTimeout(() => {
            if (isMyTurn) {
               const input = document.getElementById('word-input')
               if (input) input.focus()
            }
         }, 50)
      }
   })

   let correctAnimTimer
   $effect(() => {
      const currentWordCount = gameState.usedWords?.length || 0
      untrack(() => {
         if (currentWordCount > prevWordCount) {
            showCorrectAnim = true
            clearTimeout(correctAnimTimer)
            correctAnimTimer = setTimeout(() => {
               showCorrectAnim = false
            }, 600)
            typingWordOverride = ''
         }
         prevWordCount = currentWordCount
      })
      return () => clearTimeout(correctAnimTimer)
   })

   $effect(() => {
      const trackedMessages = activeMessages ? Object.entries(activeMessages) : []
      untrack(() => {
         let hasNewMessage = false
         for (const [pId, msg] of trackedMessages) {
            if (msg) {
               const player = gameState.players?.find((p) => p.id === pId)
               const name = player ? player.name : 'System'
               const lastLog = chatHistory[chatHistory.length - 1]
               if (!lastLog || lastLog.msg !== msg || lastLog.pId !== pId) {
                  chatHistory.push({ pId, name, msg, id: Math.random() })
                  hasNewMessage = true
               }
            }
         }
         if (hasNewMessage) {
            if (chatHistory.length > 50) chatHistory.shift()
            setTimeout(() => {
               const el = document.getElementById('game-chat-feed')
               if (el) el.scrollTop = el.scrollHeight
            }, 50)
         }
      })
   })

   $effect(() => {
      if (socket) {
         socket.on('vocab:show_emote', (data) => {
            activeEmotes[data.playerId] = data.emote
            setTimeout(() => {
               if (activeEmotes[data.playerId] === data.emote) {
                  activeEmotes[data.playerId] = undefined
               }
            }, 2000)
         })
         socket.on('vocab:trigger_scramble', (data) => {
            if (data.targetId === socketId) {
               scramblePending = true
            }
         })
         socket.on('vocab:invalid_word', () => {
            showErrorAnim = true
            setTimeout(() => {
               showErrorAnim = false
            }, 500)
         })
         return () => {
            socket.off('vocab:show_emote')
            socket.off('vocab:trigger_scramble')
            socket.off('vocab:invalid_word')
         }
      }
   })

   $effect(() => {
      if (gameState.status === 'playing') {
         if (isMyTurn && !previousTurn) {
            if (scramblePending) {
               isScrambled = true
               scramblePending = false
               setTimeout(() => {
                  isScrambled = false
               }, 2000)
            }
         }
         previousTurn = isMyTurn
      } else {
         previousTurn = false
      }
   })

   function handleWordInput(e) {
      wordInput = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase()
      if (handleTyping) handleTyping(wordInput)
   }

   function onPlayWord() {
      if (wordInput.trim()) {
         handleSubmitWord((gameState.currentPrefix + wordInput).toLowerCase().trim())
         wordInput = ''
         if (handleTyping) handleTyping('')
         typingWordOverride = ''
         setTimeout(() => {
            const input = document.getElementById('word-input')
            if (input) input.focus()
         }, 30)
      }
   }

   function onSendChat() {
      if (isBusyPlaying) return
      if (chatInput.trim() && handleSendMessage) {
         handleSendMessage(chatInput.trim())
         chatInput = ''
      }
      const chatEl = document.getElementById('chat-input')
      if (chatEl) chatEl.blur()
   }

   function handleGlobalClick(e) {
      const buttonTarget = e.target.closest('button')
      if (buttonTarget) {
         buttonTarget.blur()
      }
      if (gameState.status === 'playing') {
         const isInteractive =
            e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.closest('button')
         if (!isInteractive) {
            setTimeout(() => {
               if (isMyTurn) {
                  const input = document.getElementById('word-input')
                  if (input) input.focus()
               }
            }, 10)
         }
      }
   }

   function sendEmote(emote) {
      if (socket && me) {
         socket.emit('vocab:emote', { emote })
      }
   }

   function handleGlobalKeydown(e) {
      if (showRetireModal) return
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'
      const isButton = e.target.tagName === 'BUTTON' || e.target.closest('button')
      const isWordInput = e.target.id === 'word-input'
      if (isInput && e.key === 'Escape') {
         e.target.blur()
         return
      }
      if (isInput && !isWordInput) return
      if (!isInput && !isButton && e.key === 'Enter') {
         if (
            gameState.status === 'playing' ||
            gameState.status === 'choosing_prefix' ||
            gameState.status === 'paused'
         ) {
            e.preventDefault()
            const chatEl = document.getElementById('chat-input')
            if (chatEl && !isBusyPlaying) {
               chatEl.focus()
            }
         }
         return
      }
      if (!isInput && e.key === '6') {
         if (!isSpectator && handleTogglePause) {
            e.preventDefault()
            handleTogglePause()
         }
         return
      }
      if (!isInput && me) {
         switch (e.key.toLowerCase()) {
            case 'z':
               sendEmote(' ')
               return
            case 'x':
               sendEmote(' ')
               return
            case 'c':
               sendEmote(' ')
               return
            case 'v':
               sendEmote(' ')
               return
         }
      }
      if (!isMyTurn || gameState.status !== 'playing' || !gameState.settings?.items)
         return
      if (['1', '2', '3', '4', '5', '7', '8'].includes(e.key)) {
         e.preventDefault()
         switch (e.key) {
            case '1':
               if (me?.skills?.reverse > 0) handleUseSkill('reverse')
               break
            case '2':
               if (me?.skills?.skip > 0) handleUseSkill('skip')
               break
            case '3':
               if (me?.skills?.reroll > 0) handleUseSkill('reroll')
               break
            case '4':
               if (me?.skills?.bomb > 0) handleUseSkill('bomb')
               break
            case '5':
               if (me?.skills?.heal > 0) {
                  if (
                     gameState.settings?.teamMode &&
                     gameState.settings?.teamMode !== 'ffa'
                  ) {
                     if (gameState.teamLives?.[me.team] < gameState.settings.lives)
                        handleUseSkill('heal')
                  } else {
                     if (me.lives < gameState.settings.lives) handleUseSkill('heal')
                  }
               }
               break
            case '7':
               if (me?.skills?.nuke > 0) handleUseSkill('nuke')
               break
            case '8':
               if (me?.skills?.scramble > 0) handleUseSkill('scramble')
               break
         }
         setTimeout(() => {
            const input = document.getElementById('word-input')
            if (input) input.focus()
         }, 30)
      }
   }

   function handleRetire() {
      showRetireModal = true
   }
   function confirmRetire() {
      showRetireModal = false
      if (onLeaveRoom) onLeaveRoom()
   }
   function cancelRetire() {
      showRetireModal = false
   }
</script>

<svelte:window onkeydown={handleGlobalKeydown} onclick={handleGlobalClick} />

{#if showRetireModal}
   <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
   >
      <div
         class="bg-white rounded-[2.5rem] p-8 shadow-2xl border-4 border-slate-100 w-full max-w-md animate-in zoom-in-95 fade-in duration-200"
      >
         <div class="flex flex-col items-center text-center gap-3 mb-8">
            <div
               class="w-16 h-16 rounded-2xl bg-rose-100 border-4 border-rose-200 flex items-center justify-center text-rose-500"
            >
               <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
               >
                  <path
                     stroke-linecap="round"
                     stroke-linejoin="round"
                     stroke-width="2.5"
                     d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
               </svg>
            </div>
            <h3 class="text-3xl font-black text-slate-800 uppercase tracking-tight">
               Retire From Match?
            </h3>
            <p
               class="text-sm font-bold text-slate-400 uppercase tracking-wide leading-relaxed"
            >
               You will lose any progress and forfeit the match.
            </p>
         </div>
         <div class="flex gap-3">
            <button
               tabindex="-1"
               class="flex-1 bg-slate-200 text-slate-600 font-black py-4 rounded-2xl border-b-[4px] border-slate-300 hover:bg-slate-100 active:translate-y-[4px] active:border-b-0 uppercase transition-all"
               onclick={cancelRetire}>Stay In Match</button
            >
            <button
               tabindex="-1"
               class="flex-1 bg-rose-500 text-white font-black py-4 rounded-2xl border-b-[4px] border-rose-700 hover:bg-rose-400 active:translate-y-[4px] active:border-b-0 uppercase transition-all"
               onclick={confirmRetire}>Yes, Retire</button
            >
         </div>
      </div>
   </div>
{/if}

{#if gameState.status === 'game_over'}
   <div
      class="bg-white rounded-[2.5rem] p-8 shadow-[0_12px_0_0_rgba(148,163,184,0.4)] relative border-4 border-slate-100 max-w-5xl mx-auto mt-12 animate-in fade-in zoom-in"
   >
      <div class="items-center text-center">
         <h1
            class="text-5xl md:text-6xl font-black text-amber-500 mb-2 drop-shadow-sm tracking-tight"
         >
            GAME OVER
         </h1>
         <p class="text-slate-400 font-bold mb-8 uppercase tracking-widest text-sm">
            The battle of words has concluded.
         </p>
         <div class="w-full flex flex-col gap-4">
            {#each sortedPlayers as player, i}
               {@const eloResult = eloBySocket[player.id]}
               <div
                  class="flex items-center justify-between p-4 md:p-5 rounded-2xl border-4 {i ===
                  0
                     ? 'bg-amber-50 border-amber-200 shadow-[0_4px_0_0_rgba(253,230,138,1)]'
                     : 'bg-slate-50 border-slate-100 shadow-[0_4px_0_0_rgba(241,245,249,1)]'} transition-transform hover:-translate-y-1"
               >
                  <div class="flex items-center gap-3 md:gap-4">
                     <div
                        class="text-2xl md:text-3xl font-black {i === 0
                           ? 'text-amber-500'
                           : 'text-slate-400'}"
                     >
                        #{i + 1}
                     </div>
                     <div
                        class="font-black text-lg md:text-xl text-slate-700 text-left uppercase"
                     >
                        {player.name}
                     </div>
                  </div>
                  <div class="flex flex-col items-end gap-1.5">
                     <div class="text-xl md:text-2xl font-black text-blue-500">
                        {player.score} PTS
                     </div>
                     {#if eloResult && !player.isSpectator}
                        <div
                           class="flex items-center gap-1.5 text-xs md:text-sm font-black uppercase tracking-wide animate-in fade-in duration-200"
                        >
                           <span class="text-slate-400"
                              >{eloResult.oldElo} {eloResult.newElo}</span
                           >
                           <span
                              class="px-1.5 py-0.5 rounded-lg {eloResult.change >= 0
                                 ? 'text-emerald-600 bg-emerald-50'
                                 : 'text-rose-600 bg-rose-50'}"
                              >{eloResult.change >= 0 ? '+' : ''}{eloResult.change} ELO</span
                           >
                        </div>
                     {:else if player.isSpectator}
                        <div
                           class="text-[10px] font-bold text-slate-300 uppercase tracking-wide"
                        >
                           Spectator
                        </div>
                     {:else}
                        <div
                           class="text-[10px] font-bold text-slate-300 uppercase tracking-wide animate-pulse"
                        >
                           Calculating ELO...
                        </div>
                     {/if}
                  </div>
               </div>
            {/each}
         </div>
         <button
            tabindex="-1"
            class="mt-10 w-full bg-slate-200 text-slate-600 font-black text-xl py-4 rounded-2xl border-b-[6px] border-slate-300 hover:bg-slate-100 hover:translate-y-[2px] hover:border-b-[4px] active:translate-y-[6px] active:border-b-0 transition-all uppercase"
            onclick={() => onLeaveRoom && onLeaveRoom()}>Leave Arena</button
         >
      </div>
   </div>
{:else}
   <div class="fixed top-2 left-2 z-50">
      <button
         tabindex="-1"
         class="bg-white border-2 border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 p-2 sm:p-2.5 rounded-xl transition-all shadow-sm"
         onclick={handleRetire}
         title="Retire from match"
      >
         <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 sm:h-6 sm:w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
         >
            <path
               stroke-linecap="round"
               stroke-linejoin="round"
               stroke-width="2.5"
               d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
         </svg>
      </button>
   </div>
   <div
      class="w-full min-h-[95dvh] lg:h-[95dvh] lg:overflow-hidden flex flex-col lg:flex-row items-stretch justify-center gap-4 relative p-2 md:p-4 lg:p-6 box-border"
   >
      <!-- LEFT COLUMN -->
      <div class="w-full lg:w-72 xl:w-80 flex flex-col shrink-0 gap-4 h-full">
         <div
            class="flex flex-col bg-white rounded-3xl border-4 border-slate-100 shadow-[0_6px_0_0_rgba(226,232,240,1)] overflow-hidden shrink-0"
         >
            <div class="bg-slate-50 p-2 border-b-2 border-slate-100">
               <span
                  class="font-extrabold text-[10px] uppercase tracking-widest text-slate-400"
                  >Spectators ({spectators.length})</span
               >
            </div>
            <div
               class="p-2 overflow-y-auto playful-scrollbar flex flex-col gap-1.5 max-h-32"
            >
               {#if spectators.length === 0}
                  <div
                     class="text-[10px] font-bold text-slate-300 text-center py-1.5 uppercase"
                  >
                     None
                  </div>
               {:else}
                  {#each spectators as spec}
                     <div
                        class="flex items-center justify-between bg-slate-100 p-1.5 rounded-xl shadow-sm opacity-80 animate-in fade-in relative"
                     >
                        {#if activeMessages[spec.id]}
                           <div
                              class="absolute left-8 top-1/2 -translate-y-1/2 bg-white text-slate-700 text-[9px] px-2 py-1 rounded-lg shadow-md border border-slate-200 font-black z-50 animate-in fade-in zoom-in-95 duration-150 whitespace-pre-wrap max-w-[120px] text-left uppercase leading-tight"
                           >
                              {activeMessages[spec.id]}
                           </div>
                        {/if}
                        {#if activeEmotes[spec.id]}
                           <div
                              class="absolute left-1 -top-1 z-50 text-xl drop-shadow-md animate-float-up pointer-events-none select-none"
                           >
                              {activeEmotes[spec.id]}
                           </div>
                        {/if}
                        <div class="flex items-center gap-2">
                           <Avatar player={spec} className="w-6 h-6" />
                           <span
                              class="text-[10px] font-black text-slate-600 {spec.isSpectator
                                 ? ''
                                 : 'line-through'} max-w-24 uppercase truncate"
                              >{spec.name}</span
                           >
                        </div>
                        {#if !spec.isSpectator}
                           <span class="text-[9px] font-black text-slate-400"
                              >{spec.score}</span
                           >
                        {/if}
                     </div>
                  {/each}
               {/if}
            </div>
         </div>
         <div
            class="flex-1 h-[250px] lg:h-auto w-full flex flex-col bg-white rounded-3xl border-4 border-slate-100 shadow-[0_8px_0_0_rgba(226,232,240,1)] overflow-hidden"
         >
            <div
               class="bg-slate-50 p-3 lg:p-4 border-b-4 border-slate-100 flex justify-between items-center shrink-0"
            >
               <span
                  class="font-extrabold text-xs uppercase tracking-widest text-slate-400"
                  >Words Played</span
               >
               <span
                  class="bg-blue-100 text-blue-500 font-black px-2 py-0.5 rounded-lg text-xs"
                  >{gameState.usedWords?.length || 0}</span
               >
            </div>
            <div
               class="flex-1 p-3 lg:p-4 overflow-y-auto flex flex-row lg:flex-col flex-wrap gap-2 content-start playful-scrollbar"
            >
               {#if (gameState.usedWords?.length || 0) === 0}
                  <div
                     class="text-xs font-bold text-slate-300 w-full text-center py-6 lg:py-16 uppercase"
                  >
                     No words yet
                  </div>
               {:else}
                  {#each [...(gameState.usedWords || [])].reverse() as word}
                     <div
                        class="bg-slate-100 border-2 border-slate-200 text-slate-600 font-black px-3 py-1.5 rounded-xl text-xs uppercase shadow-sm whitespace-nowrap animate-in fade-in zoom-in w-fit"
                     >
                        {word}
                     </div>
                  {/each}
               {/if}
            </div>
         </div>
      </div>

      <!-- CENTER COLUMN -->
      <div
         class="flex-1 w-full flex flex-col items-center lg:justify-center relative min-h-[450px] lg:min-h-0 lg:h-full lg:overflow-hidden pt-2 lg:pt-0"
      >
         <div
            class="shrink-0 bg-white/80 backdrop-blur border border-slate-100 rounded-[2rem] py-1.5 px-4 font-black text-[10px] sm:text-xs z-40 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 mb-2 w-auto max-w-[95%] shadow-sm"
         >
            <span class="text-slate-400 uppercase tracking-wider"
               >Room: <span class="text-slate-700">{gameState.roomId}</span></span
            >
            <div class="w-1 h-1 rounded-full bg-slate-300"></div>
            <span class="text-blue-500 uppercase tracking-widest"
               >{gameState.turnDirection === -1
                  ? '  Counter Clockwise'
                  : '  Clockwise'}</span
            >
            <div class="w-1 h-1 rounded-full bg-slate-300"></div>
            <span class="text-indigo-500 uppercase tracking-widest"
               >Min {gameState.settings?.minLetters || 2}L</span
            >
            {#if gameState.settings?.noBaseRepetition}
               <div class="w-1 h-1 rounded-full bg-amber-300"></div>
               <span class="text-amber-600 uppercase tracking-widest">Strict Base</span>
            {/if}
            {#if gameState.settings?.diminishingTime}
               <div class="w-1 h-1 rounded-full bg-orange-300"></div>
               <span class="text-orange-600 uppercase tracking-widest">-3s Penalty</span>
            {/if}
            {#if gameState.suddenDeath}
               <div class="w-1 h-1 rounded-full bg-rose-400"></div>
               <span class="text-rose-500 uppercase tracking-widest animate-pulse"
                  >Sudden Death</span
               >
            {/if}
         </div>
         <div
            class="w-full flex-1 flex items-center justify-center py-12 sm:py-16 lg:py-8 relative overflow-visible rounded-[2.5rem] border-4 border-slate-100 shadow-sm mb-4 shrink-0 lg:shrink min-h-[350px] sm:min-h-[400px] lg:min-h-0"
         >
            <div
               class="relative w-[220px] h-[220px] min-[400px]:w-[280px] min-[400px]:h-[280px] sm:w-[340px] sm:h-[340px] lg:w-[400px] lg:h-[400px] xl:w-[480px] xl:h-[480px] max-h-[50vh] max-w-[50vh] transition-transform duration-700 ease-in-out mx-auto shrink-0 touch-none"
               style="transform: rotate({currentRotation}deg);"
            >
               <div
                  class="absolute top-1/2 left-1/2 w-1/2 h-1/2 min-w-[120px] min-h-[120px] max-w-[200px] max-h-[200px] bg-white rounded-full shadow-[0_4px_25px_rgba(0,0,0,0.08)] border-4 border-slate-50 flex flex-col items-center justify-center z-10 {showCorrectAnim
                     ? 'animate-correct'
                     : ''} {showErrorAnim ? 'animate-incorrect' : ''} {isScrambled
                     ? 'animate-scramble'
                     : ''}"
                  style="transform: translate(-50%, -50%) rotate({-currentRotation}deg); --rotation: {-currentRotation}deg;"
               >
                  {#if gameState.status === 'paused'}
                     <div
                        class="text-[9px] sm:text-[10px] min-[400px]:text-xs font-black tracking-widest text-slate-400 mb-1 uppercase"
                     >
                        Game Paused
                     </div>
                     <div
                        class="text-2xl min-[400px]:text-3xl sm:text-4xl animate-bounce mb-2"
                     ></div>
                     <p
                        class="text-[7px] min-[400px]:text-[8px] font-bold text-center text-slate-400 px-4 leading-tight uppercase"
                     >
                        Press <span class="text-amber-500">6</span> to resume
                     </p>
                  {:else if gameState.status === 'playing'}
                     <div
                        class="text-[7px] min-[400px]:text-[8px] sm:text-[9px] font-extrabold tracking-widest text-slate-400 mb-0.5 uppercase"
                     >
                        {#if gameState.settings?.teamMode && gameState.settings?.teamMode !== 'ffa'}
                           {gameState.currentTeamTurn}'s Team Turn
                        {:else}
                           Starts With
                        {/if}
                     </div>
                     <div
                        class="text-base min-[400px]:text-lg sm:text-2xl md:text-3xl font-black mb-1 sm:mb-2 text-slate-800 tracking-tight text-center whitespace-nowrap"
                     >
                        "{isScrambled ? '?' : gameState.currentPrefix?.toUpperCase()}<span
                           class="text-rose-500"
                           >{isScrambled
                              ? '???'
                              : wordInput
                                ? wordInput
                                : effectiveTypingWord}</span
                        >"
                     </div>
                     <div
                        class="radial-progress {gameState.suddenDeath
                           ? 'text-rose-500 animate-pulse'
                           : 'text-blue-500'} bg-slate-50 border border-slate-100 text-[9px] min-[400px]:text-[10px] sm:text-xs font-black"
                        style="--value:{(gameState.timeRemaining /
                           gameState.currentMaxTimer) *
                           100}; --size: 1.8rem; min-[400px]:--size: 2.2rem; sm:--size: 2.6rem; md:--size: 3rem; lg:--size: 3.5rem; --thickness: 0.3rem;"
                     >
                        <span
                           class="text-slate-700 {gameState.timeRemaining <= 5
                              ? 'text-rose-500 animate-ping'
                              : ''}">{gameState.timeRemaining}</span
                        >
                     </div>
                  {:else if gameState.status === 'choosing_prefix'}
                     <div
                        class="text-xs min-[400px]:text-sm sm:text-base text-rose-500 font-black animate-pulse mb-0.5 uppercase tracking-widest"
                     >
                        Penalty!
                     </div>
                     <p
                        class="text-[7px] min-[400px]:text-[8px] font-bold text-center text-slate-400 px-2 leading-tight"
                     >
                        Awaiting prefix selection.
                     </p>
                  {/if}
               </div>
               {#each circlePlayers as player, i}
                  {@const colors = {
                     red: {
                        ring: 'ring-rose-400',
                        glow: 'ring-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.8)]',
                        text: 'text-rose-600',
                     },
                     blue: {
                        ring: 'ring-blue-400',
                        glow: 'ring-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.8)]',
                        text: 'text-blue-600',
                     },
                     green: {
                        ring: 'ring-emerald-400',
                        glow: 'ring-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.8)]',
                        text: 'text-emerald-600',
                     },
                     yellow: {
                        ring: 'ring-amber-400',
                        glow: 'ring-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.8)]',
                        text: 'text-amber-600',
                     },
                  }}
                  {@const currentTheme = colors[player.team] || {
                     ring: '',
                     glow: '',
                     text: 'text-slate-700',
                  }}
                  {@const isCurrentlyActiveTurn =
                     gameState.settings?.teamMode &&
                     gameState.settings?.teamMode !== 'ffa'
                        ? player.team === gameState.currentTeamTurn
                        : player.id === activePlayer?.id}
                  <div
                     class="absolute top-1/2 left-1/2 transition-all duration-300 {player.lives <=
                     0
                        ? 'opacity-30 grayscale'
                        : 'opacity-100'}"
                     style="transform: translate(-50%, -50%) rotate({i *
                        (360 /
                           circlePlayers.length)}deg) translateY(clamp(-220px, -24vmin, -115px)); z-index: {isCurrentlyActiveTurn ||
                     player.id === gameState.choosingPlayerId
                        ? 50
                        : activeMessages[player.id] || activeEmotes[player.id]
                          ? 40
                          : 10 + i};"
                  >
                     <div
                        class="flex flex-col items-center gap-1 transition-transform duration-700 relative"
                        style="transform: rotate({-(
                           i * (360 / circlePlayers.length) +
                           currentRotation
                        )}deg);"
                     >
                        {#if activeMessages[player.id]}
                           <div
                              class="absolute -top-14 bg-white text-slate-700 text-[8px] min-[400px]:text-[9px] px-2 min-[400px]:px-2.5 py-1 min-[400px]:py-1.5 rounded-xl shadow border border-slate-100 font-black z-50 animate-in fade-in duration-150 whitespace-pre-wrap max-w-[90px] min-[400px]:max-w-[110px] text-center uppercase leading-tight"
                           >
                              {activeMessages[player.id]}
                           </div>
                        {/if}
                        {#if activeEmotes[player.id]}
                           <div
                              class="absolute -top-10 min-[400px]:-top-12 z-50 text-xl min-[400px]:text-2xl sm:text-3xl drop-shadow animate-float-up pointer-events-none select-none"
                           >
                              {activeEmotes[player.id]}
                           </div>
                        {/if}
                        <div class="indicator relative">
                           {#if isCurrentlyActiveTurn && gameState.status === 'playing'}
                              <span
                                 class="absolute mb-4 min-[400px]:mb-5 -top-2 left-1/2 -translate-x-1/2 z-50 bg-blue-500 text-white font-black text-[7px] min-[400px]:text-[8px] px-1 min-[400px]:px-1.5 py-0.5 rounded border-b border-blue-700 uppercase tracking-wider animate-bounce whitespace-nowrap"
                                 >Thinking</span
                              >
                           {:else if player.id === gameState.choosingPlayerId && gameState.status === 'choosing_prefix'}
                              <span
                                 class="absolute mb-4 min-[400px]:mb-5 -top-2 left-1/2 -translate-x-1/2 z-50 bg-rose-500 text-white font-black text-[7px] min-[400px]:text-[8px] px-1 min-[400px]:px-1.5 py-0.5 rounded border-b border-rose-700 uppercase tracking-wider animate-bounce whitespace-nowrap"
                                 >Choosing</span
                              >
                           {/if}
                           <div
                              class="relative z-10 transition-all duration-300 {isCurrentlyActiveTurn &&
                              gameState.status === 'playing'
                                 ? 'scale-125'
                                 : ''} {player.id === gameState.choosingPlayerId &&
                              gameState.status === 'choosing_prefix'
                                 ? 'scale-125'
                                 : ''}"
                           >
                              {#if player.combo > 0 && gameState.settings?.items}
                                 <span
                                    class="absolute -top-1 -left-2 min-[400px]:-left-2.5 z-50 bg-amber-400 border-b border-amber-600 rounded font-black text-white text-[7px] min-[400px]:text-[8px] px-1 shadow-sm animate-pulse"
                                 >
                                    {player.combo}</span
                                 >
                              {/if}
                              {#if isCurrentlyActiveTurn && gameState.status === 'playing'}
                                 <div
                                    class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-60 z-0"
                                 ></div>
                              {/if}
                              {#if player.id === gameState.choosingPlayerId && gameState.status === 'choosing_prefix'}
                                 <div
                                    class="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-60 z-0"
                                 ></div>
                              {/if}
                              <div
                                 class="relative z-10 rounded-full bg-white transition-all duration-300 {gameState
                                    .settings?.teamMode &&
                                 gameState.settings?.teamMode !== 'ffa'
                                    ? `ring-4 ring-offset-2 ${currentTheme.ring}`
                                    : ''} {isCurrentlyActiveTurn &&
                                 gameState.status === 'playing'
                                    ? `ring-4 ring-offset-2 ${gameState.settings?.teamMode && gameState.settings?.teamMode !== 'ffa' ? currentTheme.glow : 'ring-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.8)]'}`
                                    : ''}"
                              >
                                 <Avatar
                                    {player}
                                    className="w-8 h-8 min-[400px]:w-10 min-[400px]:h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 block rounded-full"
                                 />
                              </div>
                           </div>
                        </div>
                        <div
                           class="bg-white px-1.5 py-0.5 mt-3 min-[400px]:mt-4 rounded-lg font-black border border-slate-100 flex flex-col items-center min-w-[55px] min-[400px]:min-w-[65px] sm:min-w-[75px] shadow-sm leading-none"
                        >
                           <span
                              class="text-[7px] min-[400px]:text-[8px] sm:text-[9px] w-full text-center truncate uppercase font-black {gameState
                                 .settings?.teamMode &&
                              gameState.settings?.teamMode !== 'ffa'
                                 ? currentTheme.text
                                 : 'text-slate-700'}">{player.name}</span
                           >
                           <span
                              class="text-[6px] min-[400px]:text-[7px] sm:text-[8px] text-blue-500 mt-0.5"
                              >{player.score} PTS</span
                           >
                           {#if player.isSpectator}
                              <span
                                 class="text-[6px] min-[400px]:text-[7px] mt-0.5 text-slate-400 uppercase tracking-widest font-extrabold"
                                 >Spectator</span
                              >
                           {:else}
                              <div class="flex gap-0.5 mt-0.5 text-rose-500">
                                 {#each Array(gameState.settings?.lives || 0) as _, lifeIndex}
                                    <svg
                                       class="w-1.5 h-1.5 min-[400px]:w-2 min-[400px]:h-2 {lifeIndex <
                                       (gameState.settings?.teamMode &&
                                       gameState.settings?.teamMode !== 'ffa'
                                          ? (gameState.teamLives?.[player.team] ??
                                            player.lives)
                                          : player.lives)
                                          ? 'fill-current'
                                          : 'fill-slate-200'}"
                                       viewBox="0 0 20 20"
                                       ><path
                                          d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                                          fill-rule="evenodd"
                                          clip-rule="evenodd"
                                       /></svg
                                    >
                                 {/each}
                              </div>
                           {/if}
                        </div>
                     </div>
                  </div>
               {/each}
            </div>
         </div>
         <div
            class="w-full max-w-[460px] mx-auto text-center shrink-0 relative z-30 pb-4 lg:pb-0"
         >
            {#if isMyTurn && gameState.status === 'playing'}
               <div
                  class="flex flex-col gap-3 w-full animate-in slide-in-from-bottom-3 duration-150 mx-auto"
               >
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                     class="relative w-full bg-white border-4 border-slate-100 shadow-sm rounded-2xl p-2.5 sm:p-3 min-h-[72px] sm:min-h-[80px] flex flex-wrap gap-1.5 justify-center items-center cursor-text"
                     onclick={() => document.getElementById('word-input').focus()}
                  >
                     <input
                        id="word-input"
                        type="text"
                        class="absolute inset-0 opacity-0 cursor-text w-full h-full z-10"
                        bind:value={wordInput}
                        oninput={handleWordInput}
                        onkeydown={(e) => e.key === 'Enter' && onPlayWord()}
                        autofocus
                        autocomplete="off"
                        spellcheck="false"
                     />
                     {#each (gameState.currentPrefix || '').split('') as char}
                        <div
                           class="w-7 h-9 sm:w-8 sm:h-10 flex items-center justify-center font-black text-base sm:text-lg rounded-lg border-b-2 bg-blue-50 border-blue-200 text-blue-500 uppercase"
                        >
                           {isScrambled ? '?' : char}
                        </div>
                     {/each}
                     {#each wordInput.split('') as char}
                        <div
                           class="w-7 h-9 sm:w-8 sm:h-10 flex items-center justify-center font-black text-base sm:text-lg rounded-lg border-b-2 bg-slate-50 border-slate-300 text-slate-700 uppercase animate-in zoom-in-75 duration-700 text-slate-400"
                        >
                           {isScrambled ? '?' : char}
                        </div>
                     {/each}
                     <div
                        class="w-7 h-9 sm:w-8 sm:h-10 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-white animate-pulse"
                     >
                        <div
                           class="w-1/3 h-1 bg-slate-300 mt-4 sm:mt-5 rounded-full"
                        ></div>
                     </div>
                  </div>
                  <button
                     tabindex="-1"
                     class="w-full bg-rose-500 text-white font-black text-lg py-3 rounded-xl border-b-[4px] border-rose-700 hover:bg-rose-400 hover:translate-y-[1px] hover:border-b-[3px] active:translate-y-[4px] active:border-b-0 transition-all uppercase tracking-wider"
                     onclick={onPlayWord}>Submit Word</button
                  >
               </div>
            {/if}
            {#if isMyChoice && gameState.status === 'choosing_prefix'}
               <div
                  class="flex flex-col gap-4 bg-white p-5 rounded-3xl border-4 border-rose-100 text-center shadow-sm animate-in zoom-in-95 duration-150 max-w-sm mx-auto"
               >
                  <div>
                     <h3 class="text-lg font-black text-rose-500 uppercase tracking-wide">
                        You Lost a Life!
                     </h3>
                     <p class="text-xs font-bold text-slate-400 mt-1 uppercase">
                        Choose the <span class="text-blue-500"
                           >{gameState.difficulty}-letter</span
                        > prefix for the next team.
                     </p>
                  </div>
                  <div class="flex flex-row justify-center gap-2.5 mt-2">
                     {#each gameState.prefixOptions || [] as option}
                        <button
                           tabindex="-1"
                           class="flex-1 bg-rose-500 text-white font-black text-xl py-3 rounded-xl border-b-[4px] border-rose-700 hover:bg-rose-400 active:translate-y-[4px] active:border-b-0 transition-all uppercase"
                           onclick={() => handleSubmitPrefix(option)}>{option}</button
                        >
                     {/each}
                  </div>
               </div>
            {/if}
         </div>
      </div>

      <!-- RIGHT COLUMN -->
      <div class="w-full lg:w-80 xl:w-96 flex flex-col shrink-0 gap-4 h-full">
         <div
            class="flex-1 h-[400px] lg:h-auto flex flex-col bg-white rounded-3xl border-4 border-slate-100 shadow-[0_8px_0_0_rgba(226,232,240,1)] overflow-hidden"
         >
            <div class="bg-slate-50 p-3 lg:p-4 border-b-4 border-slate-100 shrink-0">
               <span
                  class="font-extrabold text-xs uppercase tracking-widest text-slate-400"
                  >Match Chat</span
               >
            </div>
            <div
               id="game-chat-feed"
               class="flex-1 p-3 overflow-y-auto flex flex-col gap-3 playful-scrollbar scroll-smooth bg-slate-50/50"
            >
               {#if chatHistory.length === 0}
                  <div
                     class="text-xs font-bold text-slate-300 w-full text-center py-6 uppercase"
                  >
                     No messages yet
                  </div>
               {/if}
               {#each chatHistory as log (log.id)}
                  <div
                     class="flex flex-col w-full {log.pId === socketId
                        ? 'items-end'
                        : 'items-start'}"
                  >
                     <span
                        class="text-[9px] font-black text-slate-400 uppercase px-1 mb-0.5"
                        >{log.name}</span
                     >
                     <span
                        class="text-xs font-bold text-slate-700 {log.pId === socketId
                           ? 'bg-blue-100 border-blue-200 text-blue-900'
                           : 'bg-white border-slate-200'} px-3 py-2 rounded-xl border max-w-[90%] break-words shadow-sm"
                        >{log.msg}</span
                     >
                  </div>
               {/each}
            </div>
            {#if gameState.status === 'playing' || gameState.status === 'choosing_prefix' || gameState.status === 'paused'}
               <div class="shrink-0 flex flex-col bg-white border-t-2 border-slate-100">
                  <div class="p-2 border-b border-slate-50 flex gap-1.5">
                     <input
                        id="chat-input"
                        type="text"
                        maxlength="60"
                        placeholder={isBusyPlaying
                           ? 'YOUR TEAM TURN!'
                           : 'Press ENTER to type...'}
                        class="flex-1 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black rounded-xl px-3 py-2 focus:outline-none focus:border-blue-300 uppercase placeholder:text-slate-400 disabled:opacity-40 shadow-inner min-w-0"
                        disabled={isBusyPlaying}
                        bind:value={chatInput}
                        onkeydown={(e) => e.key === 'Enter' && onSendChat()}
                     />
                     <button
                        tabindex="-1"
                        class="bg-blue-500 text-white font-black text-xs px-4 rounded-xl border-b-[3px] border-blue-700 hover:bg-blue-400 active:translate-y-[3px] active:border-b-0 transition-all uppercase disabled:opacity-30 shrink-0"
                        disabled={isBusyPlaying || !chatInput.trim()}
                        onclick={onSendChat}>Send</button
                     >
                  </div>
                  <div
                     class="flex items-center justify-center gap-2 py-2 px-1 select-none"
                  >
                     {#each [{ key: 'Z', emote: ' ' }, { key: 'X', emote: ' ' }, { key: 'C', emote: ' ' }, { key: 'V', emote: ' ' }] as item}
                        <button
                           type="button"
                           tabindex="-1"
                           disabled={!me}
                           onmousedown={(e) => e.preventDefault()}
                           onclick={() => sendEmote(item.emote)}
                           class="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-black transition-all hover:bg-slate-100 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent text-slate-500"
                           title="Press {item.key} to emote"
                        >
                           <span class="text-lg leading-none">{item.emote}</span>
                           <span
                              class="text-[7px] text-slate-400 border border-slate-200 px-1 py-0 rounded bg-slate-50 font-black uppercase leading-none min-w-[12px] text-center"
                              >{item.key}</span
                           >
                        </button>
                     {/each}
                     <div class="w-px h-6 bg-slate-200 mx-1"></div>
                     <button
                        type="button"
                        tabindex="-1"
                        disabled={!handleTogglePause || isSpectator}
                        onmousedown={(e) => e.preventDefault()}
                        onclick={() => handleTogglePause && handleTogglePause()}
                        class="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-black transition-all hover:bg-slate-100 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent text-amber-500 shrink-0"
                        title="Press 6 to Pause/Resume"
                     >
                        <span class="text-lg leading-none"
                           >{gameState.status === 'paused' ? ' ' : ' '}</span
                        >
                        <span
                           class="text-[7px] text-amber-500 border border-amber-200 px-1 py-0 rounded bg-amber-50 font-black uppercase leading-none min-w-[12px] text-center"
                           >6</span
                        >
                     </button>
                  </div>
               </div>
            {/if}
         </div>
         {#if gameState.status === 'playing' && gameState.settings?.items && !isSpectator}
            <div
               class="flex flex-col bg-white rounded-3xl border-4 border-slate-100 shadow-[0_8px_0_0_rgba(226,232,240,1)] overflow-hidden animate-in fade-in shrink-0"
            >
               <div class="bg-slate-50 p-3 border-b-4 border-slate-100">
                  <span
                     class="font-extrabold text-xs uppercase tracking-widest text-slate-400"
                     >Power-Ups</span
                  >
               </div>
               <div class="p-3 grid grid-cols-2 gap-2">
                  <button
                     tabindex="-1"
                     class="relative w-full bg-white border-2 border-slate-100 shadow-[0_3px_0_0_rgba(226,232,240,1)] text-blue-500 hover:bg-blue-50 hover:border-blue-200 font-black py-2 rounded-xl transition-all flex items-center justify-start px-2 gap-2 active:translate-y-[3px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed group whitespace-nowrap"
                     disabled={!isMyTurn || !me?.skills || me.skills.reverse <= 0}
                     onclick={() => handleUseSkill('reverse')}
                  >
                     <span
                        class="bg-slate-100 text-slate-400 font-black text-[8px] rounded px-1 py-0.5 border border-slate-200 leading-none shrink-0"
                        >1</span
                     >
                     <span
                        class="text-xl group-active:scale-90 transition-transform shrink-0"
                     >
                     </span>
                     <div
                        class="flex flex-col items-start leading-tight text-left min-w-0 flex-1"
                     >
                        <span class="uppercase text-[10px] tracking-wider text-slate-700"
                           >{me?.skills?.reverse || 0} Reverse</span
                        >
                     </div>
                  </button>
                  <button
                     tabindex="-1"
                     class="relative w-full bg-white border-2 border-slate-100 shadow-[0_3px_0_0_rgba(226,232,240,1)] text-amber-500 hover:bg-amber-50 hover:border-amber-200 font-black py-2 rounded-xl transition-all flex items-center justify-start px-2 gap-2 active:translate-y-[3px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed group whitespace-nowrap"
                     disabled={!isMyTurn || !me?.skills || me.skills.skip <= 0}
                     onclick={() => handleUseSkill('skip')}
                  >
                     <span
                        class="bg-slate-100 text-slate-400 font-black text-[8px] rounded px-1 py-0.5 border border-slate-200 leading-none shrink-0"
                        >2</span
                     >
                     <span
                        class="text-xl group-active:scale-90 transition-transform shrink-0"
                     >
                     </span>
                     <div
                        class="flex flex-col items-start leading-tight text-left min-w-0 flex-1"
                     >
                        <span class="uppercase text-[10px] tracking-wider text-slate-700"
                           >{me?.skills?.skip || 0} Pass</span
                        >
                     </div>
                  </button>
                  <button
                     tabindex="-1"
                     class="relative w-full bg-white border-2 border-slate-100 shadow-[0_3px_0_0_rgba(226,232,240,1)] text-indigo-500 hover:bg-indigo-50 hover:border-indigo-200 font-black py-2 rounded-xl transition-all flex items-center justify-start px-2 gap-2 active:translate-y-[3px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed group whitespace-nowrap"
                     disabled={!isMyTurn || !me?.skills || me.skills.reroll <= 0}
                     onclick={() => handleUseSkill('reroll')}
                  >
                     <span
                        class="bg-slate-100 text-slate-400 font-black text-[8px] rounded px-1 py-0.5 border border-slate-200 leading-none shrink-0"
                        >3</span
                     >
                     <span
                        class="text-xl group-active:scale-90 transition-transform shrink-0"
                     >
                     </span>
                     <div
                        class="flex flex-col items-start leading-tight text-left min-w-0 flex-1"
                     >
                        <span class="uppercase text-[10px] tracking-wider text-slate-700"
                           >{me?.skills?.reroll || 0} Reroll</span
                        >
                     </div>
                  </button>
                  <button
                     tabindex="-1"
                     class="relative w-full bg-white border-2 border-slate-100 shadow-[0_3px_0_0_rgba(226,232,240,1)] text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-black py-2 rounded-xl transition-all flex items-center justify-start px-2 gap-2 active:translate-y-[3px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed group whitespace-nowrap"
                     disabled={!isMyTurn || !me?.skills || me.skills.bomb <= 0}
                     onclick={() => handleUseSkill('bomb')}
                  >
                     <span
                        class="bg-slate-100 text-slate-400 font-black text-[8px] rounded px-1 py-0.5 border border-slate-200 leading-none shrink-0"
                        >4</span
                     >
                     <span
                        class="text-xl group-active:scale-90 transition-transform shrink-0"
                     >
                     </span>
                     <div
                        class="flex flex-col items-start leading-tight text-left min-w-0 flex-1"
                     >
                        <span class="uppercase text-[10px] tracking-wider text-slate-700"
                           >{me?.skills?.bomb || 0} Time Bomb</span
                        >
                     </div>
                  </button>
                  <button
                     tabindex="-1"
                     class="relative w-full bg-white border-2 border-slate-100 shadow-[0_3px_0_0_rgba(226,232,240,1)] text-emerald-500 hover:bg-emerald-50 hover:border-emerald-200 font-black py-2 rounded-xl transition-all flex items-center justify-start px-2 gap-2 active:translate-y-[3px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed group whitespace-nowrap"
                     disabled={!isMyTurn ||
                        !me?.skills ||
                        me.skills.heal <= 0 ||
                        (gameState.settings?.teamMode &&
                        gameState.settings?.teamMode !== 'ffa'
                           ? gameState.teamLives?.[me.team] >= gameState.settings.lives
                           : me.lives >= gameState.settings.lives)}
                     onclick={() => handleUseSkill('heal')}
                  >
                     <span
                        class="bg-slate-100 text-slate-400 font-black text-[8px] rounded px-1 py-0.5 border border-slate-200 leading-none shrink-0"
                        >5</span
                     >
                     <span
                        class="text-xl group-active:scale-90 transition-transform shrink-0"
                     >
                     </span>
                     <div
                        class="flex flex-col items-start leading-tight text-left min-w-0 flex-1"
                     >
                        <span class="uppercase text-[10px] tracking-wider text-slate-700"
                           >{me?.skills?.heal || 0} Restore</span
                        >
                     </div>
                  </button>
                  <button
                     tabindex="-1"
                     class="relative w-full bg-white border-2 border-slate-100 shadow-[0_3px_0_0_rgba(226,232,240,1)] text-fuchsia-500 hover:bg-fuchsia-50 hover:border-fuchsia-200 font-black py-2 rounded-xl transition-all flex items-center justify-start px-2 gap-2 active:translate-y-[3px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed group whitespace-nowrap"
                     disabled={!isMyTurn || !me?.skills || me.skills.scramble <= 0}
                     onclick={() => handleUseSkill('scramble')}
                  >
                     <span
                        class="bg-slate-100 text-slate-400 font-black text-[8px] rounded px-1 py-0.5 border border-slate-200 leading-none shrink-0"
                        >8</span
                     >
                     <span
                        class="text-xl group-active:scale-90 transition-transform shrink-0"
                     >
                     </span>
                     <div
                        class="flex flex-col items-start leading-tight text-left min-w-0 flex-1"
                     >
                        <span class="uppercase text-[10px] tracking-wider text-slate-700"
                           >{me?.skills?.scramble || 0} Scramble</span
                        >
                     </div>
                  </button>
                  <button
                     tabindex="-1"
                     class="col-span-2 relative w-full bg-white border-2 border-slate-100 shadow-[0_3px_0_0_rgba(226,232,240,1)] text-rose-500 hover:bg-rose-50 hover:border-rose-200 font-black py-2 rounded-xl transition-all flex items-center justify-start px-2 gap-2 active:translate-y-[3px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed group whitespace-nowrap"
                     disabled={!isMyTurn || !me?.skills || me.skills.nuke <= 0}
                     onclick={() => handleUseSkill('nuke')}
                  >
                     <span
                        class="bg-slate-100 text-slate-400 font-black text-[8px] rounded px-1 py-0.5 border border-slate-200 leading-none shrink-0"
                        >7</span
                     >
                     <span
                        class="text-xl group-active:scale-90 transition-transform shrink-0"
                     >
                     </span>
                     <div
                        class="flex flex-col items-start leading-tight text-left min-w-0 flex-1"
                     >
                        <span class="uppercase text-[10px] tracking-wider text-slate-700"
                           >{me?.skills?.nuke || 0} Drop Nuke</span
                        >
                     </div>
                  </button>
               </div>
            </div>
         {/if}
      </div>
   </div>
{/if}

<style>
   .playful-scrollbar::-webkit-scrollbar {
      width: 8px;
   }
   .playful-scrollbar::-webkit-scrollbar-track {
      background: transparent;
      border-radius: 12px;
   }
   .playful-scrollbar::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 12px;
      border: 2px solid transparent;
      background-clip: padding-box;
   }
   @keyframes float-up {
      0% {
         opacity: 0;
         transform: translateY(10px) scale(0.8);
      }
      20% {
         opacity: 1;
         transform: translateY(0px) scale(1.1);
      }
      40% {
         transform: translateY(-10px) scale(1);
      }
      100% {
         opacity: 0;
         transform: translateY(-30px);
      }
   }
   .animate-float-up {
      animation: float-up 2s ease-out forwards;
   }
   @keyframes correct-glow {
      0% {
         border-color: #f1f5f9;
         box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);
      }
      30% {
         border-color: #4ade80;
         box-shadow: 0 0 40px 10px rgba(74, 222, 128, 0.4);
         background-color: #f0fdf4;
      }
      100% {
         border-color: #f1f5f9;
         box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);
         background-color: #ffffff;
      }
   }
   .animate-correct {
      animation: correct-glow 0.6s ease-out;
   }
   @keyframes incorrect-flash-shake {
      0% {
         border-color: #f1f5f9;
         box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);
         translate: 0 0;
      }
      20% {
         translate: -6px 0;
         border-color: #f87171;
         background-color: #fef2f2;
         box-shadow: 0 0 40px 10px rgba(244, 63, 94, 0.4);
      }
      40% {
         translate: 6px 0;
         border-color: #f87171;
         background-color: #fef2f2;
         box-shadow: 0 0 40px 10px rgba(244, 63, 94, 0.4);
      }
      60% {
         translate: -6px 0;
         border-color: #f87171;
         background-color: #fef2f2;
         box-shadow: 0 0 40px 10px rgba(244, 63, 94, 0.4);
      }
      80% {
         translate: 6px 0;
         border-color: #f87171;
         background-color: #fef2f2;
         box-shadow: 0 0 40px 10px rgba(244, 63, 94, 0.4);
      }
      100% {
         border-color: #f1f5f9;
         box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);
         background-color: #ffffff;
         translate: 0 0;
      }
   }
   .animate-incorrect {
      animation: incorrect-flash-shake 0.5s ease-in-out;
   }
   @keyframes scramble-shake {
      0%,
      100% {
         transform: translate(-50%, -50%) rotate(var(--rotation, 0deg)) translate(0, 0);
      }
      25% {
         transform: translate(-50%, -50%) rotate(var(--rotation, 0deg))
            translate(4px, -4px) skewX(5deg);
      }
      50% {
         transform: translate(-50%, -50%) rotate(var(--rotation, 0deg))
            translate(-4px, 4px) skewY(-5deg);
      }
      75% {
         transform: translate(-50%, -50%) rotate(var(--rotation, 0deg))
            translate(4px, 4px) skewX(-5deg);
      }
   }
   .animate-scramble {
      animation: scramble-shake 0.3s infinite;
      transition:
         filter 0.2s,
         transform 0.2s;
   }
</style>
