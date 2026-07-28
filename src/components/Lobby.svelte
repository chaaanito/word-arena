<script>
   import { searchParams } from 'sv-router'
   import Avatar from './Avatar.svelte'

   let {
      gameState,
      socketId,
      socket,
      activeMessages,
      handleSendMessage,
      onStartGame,
      showError,
      onLeaveRoom,
      onlinePlayersList = [],
   } = $props()

   let isHost = $derived(gameState.hostId === socketId)
   let showSettingsModal = $state(false)
   let chatInput = $state('')
   let invitedPlayerIds = $state([])

   let me = $derived(gameState.players.find((p) => p.id === socketId))
   let activePlayers = $derived(gameState.players.filter((p) => !p.isSpectator))

   const TEAM_THEMES = [
      {
         id: 'red',
         label: 'Team Red',
         bg: 'bg-rose-50',
         border: 'border-rose-100',
         text: 'text-rose-500',
         accent: 'bg-rose-500',
      },
      {
         id: 'blue',
         label: 'Team Blue',
         bg: 'bg-blue-50',
         border: 'border-blue-100',
         text: 'text-blue-500',
         accent: 'bg-blue-500',
      },
      {
         id: 'green',
         label: 'Team Green',
         bg: 'bg-emerald-50',
         border: 'border-emerald-100',
         text: 'text-emerald-500',
         accent: 'bg-emerald-500',
      },
      {
         id: 'yellow',
         label: 'Team Yellow',
         bg: 'bg-amber-50',
         border: 'border-amber-100',
         text: 'text-amber-500',
         accent: 'bg-amber-500',
      },
   ]

   let maxTeamSlots = $derived(
      gameState?.settings?.teamMode === '2v2'
         ? 2
         : gameState?.settings?.teamMode === '3v3'
           ? 3
           : gameState?.settings?.teamMode === '4v4'
             ? 4
             : 1
   )

   let computedTeamCount = $derived(
      gameState?.settings?.teamMode !== 'ffa'
         ? Math.ceil(gameState.maxPlayers / maxTeamSlots)
         : 0
   )

   let activeTeamsList = $derived(TEAM_THEMES.slice(0, computedTeamCount))
   let spectatorPlayers = $derived(gameState.players.filter((p) => p.isSpectator))
   let uniqueOnlinePlayers = $derived(
      Array.from(new Map(onlinePlayersList.map((p) => [p.dbId, p])).values()).filter(
         (p) => String(p.roomId) !== String(gameState.roomId)
      )
   )

   $effect(() => {
      if (gameState?.roomId && socket) searchParams.set('roomId', gameState?.roomId)
   })

   $effect(() => {
      if (socket) {
         const onInviteResponse = (data) => {
            invitedPlayerIds = invitedPlayerIds.filter((id) => id !== data.targetDbId)
            if (data.status === 'declined')
               showError(`${data.targetName} declined your invite.`)
            else if (data.status === 'busy')
               showError('That player is already in a match!')
            else if (data.status === 'offline') showError('That player went offline.')
         }
         socket.on('vocab:invite_response', onInviteResponse)
         return () => socket.off('vocab:invite_response', onInviteResponse)
      }
   })

   let chatHistory = $state([])
   let lastProcessed = {}

   $effect(() => {
      if (activeMessages) {
         for (const pId in lastProcessed) {
            if (!activeMessages[pId]) delete lastProcessed[pId]
         }
         for (const pId in activeMessages) {
            const msg = activeMessages[pId]
            if (msg && lastProcessed[pId] !== msg) {
               lastProcessed[pId] = msg
               const player = gameState.players.find((p) => p.id === pId)
               const name = player ? player.name : 'System'
               chatHistory.push({ pId, name, msg, id: Math.random() })
               if (chatHistory.length > 40) chatHistory.shift()
               setTimeout(() => {
                  const el = document.getElementById('lobby-chat-feed')
                  if (el) el.scrollTop = el.scrollHeight
               }, 30)
            }
         }
      }
   })

   let tempLives = $state(3)
   let tempTimer = $state(15)
   let tempCombo = $state(5)
   let tempItems = $state(true)
   let tempMode = $state('classic')
   let tempMinLetters = $state(2)
   let tempNoBaseRepetition = $state(false)
   let tempDiminishingTime = $state(false)
   let tempTeamMode = $state('ffa')

   function copyRoomCode() {
      navigator.clipboard.writeText(String(gameState.roomId || ''))
      showError('Copied to clipboard!')
   }

   function openSettings() {
      if (!isHost) return
      tempLives = gameState?.settings?.lives ?? 3
      tempTimer = gameState?.settings?.timer ?? 15
      tempCombo = gameState?.settings?.combo ?? 5
      tempItems = gameState?.settings?.items ?? true
      tempMode = gameState?.settings?.gameMode ?? 'classic'
      tempMinLetters = gameState?.settings?.minLetters ?? 2
      tempNoBaseRepetition = gameState?.settings?.noBaseRepetition ?? false
      tempDiminishingTime = gameState?.settings?.diminishingTime ?? false
      tempTeamMode = gameState?.settings?.teamMode ?? 'ffa'
      showSettingsModal = true
   }

   function saveSettings() {
      if (socket) {
         socket.emit('vocab:update_settings', {
            lives: tempLives,
            timer: tempTimer,
            combo: tempCombo,
            items: tempItems,
            gameMode: tempMode,
            minLetters: tempMinLetters,
            noBaseRepetition: tempNoBaseRepetition,
            diminishingTime: tempDiminishingTime,
            teamMode: tempTeamMode,
         })
      }
      showSettingsModal = false
   }

   function handleSetTeam(team) {
      if (socket) socket.emit('vocab:set_team', { team })
   }

   function onSendLobbyChat() {
      if (chatInput && String(chatInput).trim() && handleSendMessage) {
         handleSendMessage(String(chatInput).trim())
         chatInput = ''
      }
   }

   function handleInvite(targetDbId) {
      if (socket) {
         socket.emit('vocab:invite_player', {
            targetDbId,
            roomId: String(gameState.roomId || ''),
         })
         if (!invitedPlayerIds.includes(targetDbId)) {
            invitedPlayerIds = [...invitedPlayerIds, targetDbId]
            setTimeout(() => {
               invitedPlayerIds = invitedPlayerIds.filter((id) => id !== targetDbId)
            }, 15000)
         }
         const toastEl = document.createElement('div')
         toastEl.className =
            'fixed top-4 left-1/2 -translate-x-1/2 bg-indigo-500 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-4 uppercase tracking-widest border-b-[4px] border-indigo-700'
         toastEl.innerText = 'Invite Sent!'
         document.body.appendChild(toastEl)
         setTimeout(() => {
            toastEl.classList.add('animate-out', 'fade-out', 'slide-out-to-top-4')
            setTimeout(() => toastEl.remove(), 200)
         }, 2000)
      }
   }
</script>

<div class="w-full max-w-5xl mx-auto flex flex-col lg:flex-row gap-6 px-4">
   <div
      class="flex-1 bg-white rounded-[2.5rem] p-6 md:p-8 shadow-[0_12px_0_0_rgba(148,163,184,0.4)] border-4 border-slate-100 relative overflow-hidden flex flex-col h-auto"
   >
      {#if gameState.status === 'starting'}
         <div
            class="flex flex-col items-center justify-center min-h-[400px] animate-in zoom-in fade-in duration-300"
         >
            <h2 class="text-3xl font-black text-slate-400 uppercase tracking-widest mb-6">
               Get Ready!
            </h2>
            <div
               class="text-[120px] md:text-[160px] font-black text-rose-500 drop-shadow-md leading-none animate-bounce"
            >
               {gameState.countdown}
            </div>
         </div>
      {:else}
         <div>
            <div class="flex justify-between items-center mb-6 relative">
               <button
                  class="absolute top-0 left-0 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-500 p-3 rounded-2xl transition-all shadow-sm"
                  onclick={() => onLeaveRoom && onLeaveRoom()}
                  title="Leave Room"
               >
                  <svg
                     xmlns="http://www.w3.org/2000/svg"
                     class="h-6 w-6"
                     fill="none"
                     viewBox="0 0 24 24"
                     stroke="currentColor"
                  >
                     <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="3"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                     />
                  </svg>
               </button>
               <h2
                  class="text-4xl font-black text-slate-800 tracking-tight flex-1 text-center"
               >
                  Arena <span class="text-blue-500">Lobby</span>
               </h2>
               {#if isHost}
                  <button
                     class="absolute top-0 right-0 bg-slate-100 hover:bg-slate-200 text-slate-500 p-3 rounded-2xl transition-all shadow-sm"
                     onclick={openSettings}
                     title="Settings"
                  >
                     <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                     >
                        <path
                           stroke-linecap="round"
                           stroke-linejoin="round"
                           stroke-width="3"
                           d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                           stroke-linecap="round"
                           stroke-linejoin="round"
                           stroke-width="3"
                           d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                     </svg>
                  </button>
               {/if}
            </div>
            <div
               class="bg-slate-100 border-4 border-slate-200 rounded-3xl p-5 mb-4 flex items-center justify-between shadow-inner"
            >
               <div class="text-left">
                  <div
                     class="text-sm font-extrabold text-blue-500 mb-1 uppercase tracking-widest"
                  >
                     Room Code
                  </div>
                  <div
                     class="text-5xl font-black tracking-[0.2em] font-mono text-slate-700"
                  >
                     {gameState.roomId}
                  </div>
               </div>
               <!-- svelte-ignore a11y_consider_explicit_label -->
               <button
                  class="bg-blue-500 text-white p-4 rounded-2xl border-b-[6px] border-blue-700 hover:bg-blue-400 hover:translate-y-[2px] hover:border-b-[4px] active:translate-y-[6px] active:border-b-0 transition-all duration-100 group"
                  onclick={copyRoomCode}
               >
                  <svg
                     xmlns="http://www.w3.org/2000/svg"
                     class="h-8 w-8 group-active:scale-95 transition-transform"
                     fill="none"
                     viewBox="0 0 24 24"
                     stroke="currentColor"
                  >
                     <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="3"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                     />
                  </svg>
               </button>
            </div>

            <!-- ROOM DETAILS CONFIGURATION GRID -->
            <div class="flex flex-wrap gap-2 justify-center mb-6">
               <span
                  class="bg-indigo-50 border-2 border-indigo-200 text-indigo-600 text-[10px] font-black uppercase px-3 py-1 rounded-xl shadow-sm"
               >
                  {gameState?.settings?.teamMode === 'ffa'
                     ? 'Free For All'
                     : gameState?.settings?.teamMode}
               </span>
               <span
                  class="{gameState?.settings?.gameMode === 'shared_prefix'
                     ? 'bg-purple-50 border-purple-200 text-purple-600'
                     : 'bg-blue-50 border-blue-200 text-blue-600'} border-2 text-[10px] font-black uppercase px-3 py-1 rounded-xl shadow-sm"
               >
                  {gameState?.settings?.gameMode === 'shared_prefix'
                     ? 'Shared Prefix'
                     : 'Classic Mode'}
               </span>
               <span
                  class="bg-slate-50 border-2 border-slate-200 text-slate-500 text-[10px] font-black uppercase px-3 py-1 rounded-xl shadow-sm"
               >
                  {gameState?.settings?.lives ?? 3} Lives
               </span>
               <span
                  class="bg-slate-50 border-2 border-slate-200 text-slate-500 text-[10px] font-black uppercase px-3 py-1 rounded-xl shadow-sm"
               >
                  {gameState?.settings?.timer ?? 15}s Turns
               </span>
               <span
                  class="bg-emerald-50 border-2 border-emerald-200 text-emerald-600 text-[10px] font-black uppercase px-3 py-1 rounded-xl shadow-sm"
               >
                  Min {gameState?.settings?.minLetters ?? 2} Letters
               </span>
               <span
                  class="bg-amber-50 border-2 border-amber-200 text-amber-600 text-[10px] font-black uppercase px-3 py-1 rounded-xl shadow-sm"
               >
                  {gameState?.settings?.combo ?? 5} Combo Req
               </span>

               {#if gameState?.settings?.items}
                  <span
                     class="bg-green-50 border-2 border-green-200 text-green-600 text-[10px] font-black uppercase px-3 py-1 rounded-xl shadow-sm"
                  >
                     Skills Enabled
                  </span>
               {/if}
               {#if gameState?.settings?.noBaseRepetition}
                  <span
                     class="bg-rose-50 border-2 border-rose-200 text-rose-500 text-[10px] font-black uppercase px-3 py-1 rounded-xl shadow-sm"
                  >
                     Strict Base
                  </span>
               {/if}
               {#if gameState?.settings?.diminishingTime}
                  <span
                     class="bg-orange-50 border-2 border-orange-200 text-orange-600 text-[10px] font-black uppercase px-3 py-1 rounded-xl shadow-sm"
                  >
                     -3s Penalty
                  </span>
               {/if}
            </div>

            <div class="w-full mb-6">
               <h3
                  class="font-extrabold text-slate-400 text-sm uppercase tracking-wider mb-3 ml-2"
               >
                  Contenders ({activePlayers.length}/{gameState.maxPlayers})
               </h3>
               {#if gameState?.settings?.teamMode && gameState?.settings?.teamMode !== 'ffa'}
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {#each activeTeamsList as team}
                        {@const teamPlayers = gameState.players.filter(
                           (p) => !p.isSpectator && p.team === team.id
                        )}
                        <div
                           class="{team.bg} border-4 {team.border} rounded-[2rem] p-4 flex flex-col justify-between shadow-inner"
                        >
                           <div>
                              <div
                                 class="text-center font-black {team.text} uppercase tracking-widest mt-1 mb-3"
                              >
                                 {team.label} ({teamPlayers.length}/{maxTeamSlots})
                              </div>
                              <ul class="flex flex-col gap-2">
                                 {#each teamPlayers as player}
                                    <li
                                       class="bg-white border-2 rounded-2xl p-2.5 flex items-center justify-between shadow-sm"
                                    >
                                       <div
                                          class="flex items-center gap-2 min-w-0 flex-1"
                                       >
                                          <Avatar {player} className="w-8 h-8 shrink-0" />
                                          <span
                                             class="truncate ml-1.5 font-black text-slate-700 text-sm"
                                             >{player.name}</span
                                          >
                                          {#if player.id === socketId}<span
                                                class="text-slate-400 text-xs">(You)</span
                                             >{/if}
                                       </div>
                                       {#if player.id === gameState.hostId}
                                          <span
                                             class="bg-slate-700 text-white font-black px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider"
                                             >Host</span
                                          >
                                       {/if}
                                    </li>
                                 {/each}
                                 {#each Array(Math.max(0, maxTeamSlots - teamPlayers.length)) as _}
                                    <div
                                       class="border-2 border-dashed border-slate-200 bg-white/40 rounded-2xl p-3 text-center text-[11px] font-black text-slate-400/50 uppercase tracking-wide"
                                    >
                                       Empty Slot
                                    </div>
                                 {/each}
                              </ul>
                           </div>
                           {#if me && !me.isSpectator && me.team !== team.id && teamPlayers.length < maxTeamSlots}
                              <button
                                 class="mt-4 w-full {team.accent} text-white border-b-[4px] border-black/20 font-black py-2.5 rounded-xl uppercase text-xs hover:brightness-110 active:translate-y-[2px] active:border-b-0 transition-all"
                                 onclick={() => handleSetTeam(team.id)}>Join</button
                              >
                           {/if}
                        </div>
                     {/each}
                  </div>
                  {#if spectatorPlayers.length > 0}
                     <div
                        class="mt-4 bg-slate-50 border-4 border-slate-100 rounded-[2rem] p-3 shadow-inner"
                     >
                        <div
                           class="text-center font-black text-slate-400 uppercase tracking-widest text-xs mb-3"
                        >
                           Spectators
                        </div>
                        <div class="flex flex-wrap gap-2 justify-center">
                           {#each spectatorPlayers as spec}
                              <div
                                 class="bg-white border-2 border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm opacity-70"
                              >
                                 <Avatar player={spec} className="w-6 h-6 shrink-0" />
                                 <span
                                    class="font-black text-slate-500 text-xs truncate max-w-[100px]"
                                    >{spec.name}</span
                                 >
                              </div>
                           {/each}
                        </div>
                     </div>
                  {/if}
               {:else}
                  <ul
                     class="bg-slate-50 border-4 border-slate-100 rounded-[2rem] p-3 flex flex-col gap-3 shadow-inner h-auto"
                  >
                     {#each gameState.players as player}
                        <li
                           class="bg-white border-2 border-slate-200 rounded-2xl p-4 flex justify-between items-center shadow-[0_4px_0_0_rgba(226,232,240,1)] relative gap-4 {player.isSpectator
                              ? 'opacity-70'
                              : ''}"
                        >
                           <div
                              class="font-black text-slate-700 text-lg flex items-center gap-2 min-w-0 flex-1"
                           >
                              <Avatar {player} className="w-12 h-12" />
                              <span class="truncate ml-2">{player.name}</span>
                              {#if player.id === socketId}<span
                                    class="text-slate-400 text-xs shrink-0">(You)</span
                                 >{/if}
                              {#if player.isSpectator}
                                 <span
                                    class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 bg-slate-100 px-2 py-1 rounded-md shrink-0"
                                    >Spectating
                                 </span>
                              {:else}
                                 <span
                                    class="shrink-0 bg-indigo-50 text-indigo-500 border-2 border-indigo-100 text-[10px] font-black px-2 py-1 rounded-xl uppercase tracking-wider"
                                    title="Current ELO rating"
                                    >ELO {player.elo ?? 1000}</span
                                 >
                              {/if}
                           </div>
                           {#if player.id === gameState.hostId}
                              <span
                                 class="bg-rose-500 text-white font-black px-4 py-1.5 rounded-xl text-sm border-b-[4px] border-rose-700 uppercase tracking-widest shadow-sm shrink-0"
                                 >Host</span
                              >
                           {:else if !player.isSpectator}
                              <span
                                 class="bg-emerald-400 text-white font-black px-4 py-1.5 rounded-xl text-sm border-b-[4px] border-emerald-600 uppercase tracking-widest shadow-sm shrink-0"
                                 >Ready</span
                              >
                           {/if}
                        </li>
                     {/each}
                  </ul>
               {/if}
            </div>
         </div>
         <div class="w-full mt-4">
            {#if isHost}
               <button
                  class="w-full text-white font-black text-xl py-5 rounded-2xl transition-all duration-100 {activePlayers.length >
                  1
                     ? 'bg-rose-500 border-b-[6px] border-rose-700 hover:bg-rose-400 hover:translate-y-[2px] hover:border-b-[4px] active:translate-y-[6px] active:border-b-0'
                     : 'bg-slate-300 border-b-[6px] border-slate-400 cursor-not-allowed opacity-80'}"
                  disabled={activePlayers.length < 2}
                  onclick={onStartGame}
               >
                  {activePlayers.length > 1
                     ? 'START BATTLE!'
                     : 'WAITING FOR 2+ COMBATANTS...'}
               </button>
            {:else}
               <div
                  class="w-full bg-amber-100 border-4 border-amber-200 text-amber-600 font-black text-xl py-5 rounded-2xl text-center flex items-center justify-center gap-3 shadow-inner"
               >
                  WAITING FOR HOST...
               </div>
            {/if}
         </div>
      {/if}
   </div>
   {#if gameState.status !== 'starting'}
      <div
         class="w-full lg:w-80 bg-white rounded-[2.5rem] p-6 shadow-[0_12px_0_0_rgba(148,163,184,0.4)] border-4 border-slate-100 flex flex-col gap-4"
      >
         <div class="bg-slate-50 p-3 border-b-4 border-slate-100 rounded-2xl text-center">
            <span class="font-extrabold text-xs uppercase tracking-widest text-slate-400"
               >Lobby Chat</span
            >
         </div>
         <div
            id="lobby-chat-feed"
            class="h-[360px] lg:h-auto lg:flex-1 lg:min-h-[240px] overflow-y-auto playful-scrollbar pr-1 flex flex-col gap-2.5 content-start"
         >
            {#if chatHistory.length === 0}
               <div
                  class="text-xs font-bold text-slate-300 text-center py-24 uppercase tracking-wide"
               >
                  No messages yet. Say hello!
               </div>
            {:else}
               {#each chatHistory as log (log.id)}
                  <div
                     class="bg-slate-50 border-2 border-slate-200 p-3 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 shadow-sm flex flex-col gap-0.5"
                  >
                     <span
                        class="text-[10px] font-black uppercase {log.pId === socketId
                           ? 'text-blue-500'
                           : 'text-slate-400'}">{log.name}</span
                     >
                     <span
                        class="text-sm font-bold text-slate-700 uppercase tracking-wide break-words"
                        >{log.msg}</span
                     >
                  </div>
               {/each}
            {/if}
         </div>
         <div class="flex gap-2 pt-2 border-t-4 border-slate-100">
            <input
               type="text"
               maxlength="60"
               placeholder="CHAT HERE..."
               class="flex-1 w-full min-w-0 bg-slate-100 border-4 border-slate-200 text-slate-700 text-xs font-black rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-300 focus:bg-white transition-colors shadow-inner uppercase placeholder:text-slate-400"
               bind:value={chatInput}
               onkeydown={(e) => e.key === 'Enter' && onSendLobbyChat()}
            />
            <button
               class="bg-blue-500 text-white font-black text-xs px-4 rounded-xl border-b-[4px] border-blue-700 hover:bg-blue-400 hover:translate-y-[1px] hover:border-b-[3px] active:translate-y-[4px] active:border-b-0 transition-all uppercase shrink-0"
               onclick={onSendLobbyChat}>Send</button
            >
         </div>
      </div>
   {/if}
</div>

{#if gameState.status !== 'starting'}
   <div class="w-full max-w-5xl mx-auto px-4 pb-12 mt-6">
      <div
         class="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-[0_12px_0_0_rgba(148,163,184,0.4)] border-4 border-slate-100 flex flex-col"
      >
         <div class="flex items-center gap-4 mb-6">
            <h2
               class="text-2xl md:text-3xl font-black text-slate-800 tracking-tight drop-shadow-sm uppercase whitespace-nowrap"
            >
               Recruit <span class="text-emerald-500">Fighters</span>
            </h2>
            <div class="flex-grow border-t-4 border-dashed border-slate-200 mt-1"></div>
            <span
               class="bg-emerald-100 text-emerald-600 border-2 border-emerald-200 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-widest shrink-0 animate-pulse"
            >
               {Math.max(0, uniqueOnlinePlayers.length - (me ? 1 : 0))} Available
            </span>
         </div>
         <div
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[300px] overflow-y-auto playful-scrollbar pr-2"
         >
            {#if uniqueOnlinePlayers.length === 0 || (uniqueOnlinePlayers.length === 1 && me)}
               <div
                  class="col-span-full text-center py-12 text-slate-400 font-bold uppercase tracking-wide text-sm bg-slate-50 rounded-3xl border-4 border-dashed border-slate-200"
               >
                  No other fighters are currently online.
               </div>
            {:else}
               {#each uniqueOnlinePlayers as player}
                  {#if !me || player.dbId !== me.dbId}
                     <div
                        class="flex items-center justify-between bg-slate-50 border-2 border-slate-100 p-3 rounded-2xl shadow-sm hover:bg-white hover:-translate-y-1 hover:shadow-md transition-all"
                     >
                        <div class="flex items-center gap-3 min-w-0">
                           <Avatar {player} className="w-6 h-6 shrink-0 mr-5" />
                           <span
                              class="font-extrabold text-slate-700 uppercase tracking-wide text-sm truncate"
                              >{player.name}</span
                           >
                        </div>
                        <div class="shrink-0 ml-2">
                           {#if invitedPlayerIds.includes(player.dbId)}
                              <span
                                 class="text-[10px] font-black uppercase text-indigo-500 bg-indigo-100 px-3 py-2 rounded-lg"
                                 >Invited</span
                              >
                           {:else if player.roomId}
                              <span
                                 class="text-[10px] font-black uppercase text-rose-400 bg-rose-100 px-3 py-2 rounded-lg"
                                 >Busy</span
                              >
                           {:else}
                              <button
                                 class="bg-indigo-500 text-white font-black text-[10px] px-4 py-2 rounded-lg border-b-[3px] border-indigo-700 hover:bg-indigo-400 active:translate-y-[3px] active:border-b-0 uppercase transition-all"
                                 onclick={() => handleInvite(player.dbId)}>Invite</button
                              >
                           {/if}
                        </div>
                     </div>
                  {/if}
               {/each}
            {/if}
         </div>
      </div>
   </div>
{/if}

{#if showSettingsModal}
   <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4 py-6"
   >
      <div
         class="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-2xl border-4 border-slate-100 w-full max-w-3xl max-h-[95vh] overflow-y-auto playful-scrollbar animate-in zoom-in-95 fade-in duration-200"
      >
         <h3
            class="text-3xl md:text-4xl font-black text-slate-800 text-center mb-8 uppercase tracking-tight"
         >
            Arena Rules
         </h3>
         <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
            <div
               class="md:col-span-2 bg-slate-50 border-4 border-slate-100 p-4 md:p-5 rounded-3xl"
            >
               <label
                  class="flex justify-center font-black text-slate-500 text-sm uppercase mb-3"
                  >Team Matching Configuration</label
               >
               <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {#each ['ffa', '2v2', '3v3', '4v4'] as mode}
                     <button
                        type="button"
                        class="py-2.5 rounded-xl border-b-[4px] font-black uppercase text-xs transition-all {tempTeamMode ===
                        mode
                           ? 'bg-indigo-500 text-white border-indigo-700'
                           : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100'}"
                        onclick={() => (tempTeamMode = mode)}
                        >{mode === 'ffa' ? 'Free For All' : mode}</button
                     >
                  {/each}
               </div>
            </div>
            <div
               class="md:col-span-2 bg-slate-50 border-4 border-slate-100 p-4 md:p-5 rounded-3xl"
            >
               <label
                  class="flex justify-center font-black text-slate-500 text-sm md:text-base uppercase mb-3"
                  >Game Mode</label
               >
               <div class="flex flex-col sm:flex-row gap-3">
                  <button
                     type="button"
                     class="flex-1 py-3 md:py-4 rounded-xl border-b-[4px] font-black uppercase text-sm transition-all {tempMode ===
                     'classic'
                        ? 'bg-blue-500 text-white border-blue-700'
                        : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100 active:border-b-0 active:translate-y-[4px]'}"
                     onclick={() => (tempMode = 'classic')}>Classic</button
                  >
                  <button
                     type="button"
                     class="flex-1 py-3 md:py-4 rounded-xl border-b-[4px] font-black uppercase text-sm transition-all {tempMode ===
                     'shared_prefix'
                        ? 'bg-purple-500 text-white border-purple-700'
                        : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100 active:border-b-0 active:translate-y-[4px]'}"
                     onclick={() => (tempMode = 'shared_prefix')}>Round Robin</button
                  >
               </div>
               <p
                  class="text-[10px] sm:text-xs text-slate-400 font-bold uppercase mt-3 text-center tracking-wide"
               >
                  {tempMode === 'classic'
                     ? 'A random prefix is generated for every turn.'
                     : 'Players share the same prefix for a full round.'}
               </p>
            </div>
            <div class="flex flex-col gap-4">
               <div class="bg-slate-50 border-4 border-slate-100 p-4 md:p-5 rounded-3xl">
                  <label
                     class="flex justify-between font-black text-slate-500 text-sm uppercase mb-3"
                     >Starting Lives <span class="text-rose-500">{tempLives}</span></label
                  >
                  <input
                     type="range"
                     min="1"
                     max="10"
                     bind:value={tempLives}
                     class="range range-primary"
                  />
               </div>
               <div class="bg-slate-50 border-4 border-slate-100 p-4 md:p-5 rounded-3xl">
                  <label
                     class="flex justify-between font-black text-slate-500 text-sm uppercase mb-3"
                     >Turn Timer <span class="text-blue-500">{tempTimer}s</span></label
                  >
                  <input
                     type="range"
                     min="5"
                     max="30"
                     step="5"
                     bind:value={tempTimer}
                     class="range range-info"
                  />
               </div>
               <div class="bg-slate-50 border-4 border-slate-100 p-4 md:p-5 rounded-3xl">
                  <label
                     class="flex justify-between font-black text-slate-500 text-sm uppercase mb-3"
                     >Min Letters <span class="text-emerald-500">{tempMinLetters}</span
                     ></label
                  >
                  <input
                     type="range"
                     min="1"
                     max="10"
                     bind:value={tempMinLetters}
                     class="range range-accent"
                  />
               </div>
            </div>
            <div class="flex flex-col gap-4">
               <div class="bg-slate-50 border-4 border-slate-100 p-4 md:p-5 rounded-3xl">
                  <label
                     class="flex justify-between font-black text-slate-500 text-sm uppercase mb-3"
                     >Combo Req <span class="text-amber-500">{tempCombo} Words</span
                     ></label
                  >
                  <input
                     type="range"
                     min="2"
                     max="10"
                     bind:value={tempCombo}
                     class="range range-warning"
                  />
               </div>
               <div
                  class="flex items-center justify-between bg-slate-50 border-4 border-slate-100 p-4 md:p-5 rounded-3xl"
               >
                  <span class="font-black text-slate-600 uppercase text-sm"
                     >Enable Skills</span
                  >
                  <input
                     type="checkbox"
                     class="toggle toggle-success toggle-lg"
                     bind:checked={tempItems}
                  />
               </div>
               <div
                  class="flex items-center justify-between bg-slate-50 border-4 border-slate-100 p-4 md:p-5 rounded-3xl"
               >
                  <div class="flex flex-col pr-3">
                     <span
                        class="font-black text-slate-600 uppercase text-sm leading-tight mb-0.5"
                        >Strict Base Words</span
                     >
                     <span
                        class="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold leading-tight"
                        >Blocks repeats (e.g. Fix, Fixed)</span
                     >
                  </div>
                  <input
                     type="checkbox"
                     class="toggle toggle-error toggle-lg"
                     bind:checked={tempNoBaseRepetition}
                  />
               </div>
               <div
                  class="flex items-center justify-between bg-slate-50 border-4 border-slate-100 p-4 md:p-5 rounded-3xl"
               >
                  <div class="flex flex-col pr-3">
                     <span
                        class="font-black text-slate-600 uppercase text-sm leading-tight mb-0.5"
                        >Diminishing Time</span
                     >
                     <span
                        class="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold leading-tight"
                        >-3s on incorrect guess</span
                     >
                  </div>
                  <input
                     type="checkbox"
                     class="toggle toggle-warning toggle-lg"
                     bind:checked={tempDiminishingTime}
                  />
               </div>
            </div>
         </div>
         <div class="flex flex-col sm:flex-row gap-3 md:gap-4">
            <button
               class="flex-1 bg-slate-200 text-slate-600 font-black text-lg md:text-xl py-4 rounded-2xl border-b-[4px] border-slate-300 hover:bg-slate-100 active:translate-y-[4px] active:border-b-0 uppercase transition-all"
               onclick={() => (showSettingsModal = false)}>Cancel</button
            >
            <button
               class="flex-1 bg-emerald-500 text-white font-black text-lg md:text-xl py-4 rounded-2xl border-b-[4px] border-emerald-700 hover:bg-emerald-400 active:translate-y-[4px] active:border-b-0 uppercase transition-all"
               onclick={saveSettings}>Save Changes</button
            >
         </div>
      </div>
   </div>
{/if}
