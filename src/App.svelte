<script>
   import { onMount } from 'svelte'
   import { io } from 'socket.io-client'
   import Home from './components/Home.svelte'
   import Lobby from './components/Lobby.svelte'
   import Game from './components/Game.svelte'
   import { searchParams } from 'sv-router'
   import GameAudio from './components/GameAudio.svelte'
   import { domain, pb, current } from './scripts/Pocketbase.svelte'

   const socketDomain = 'https://arena-socket.studylive.online'

   // CRITICAL FIX 1: Do not wrap the socket in $state() or $state.raw()
   // This prevents Svelte 5 from breaking Socket.io's internal scope and emit functions.
   let socket = null

   let view = $state('home')
   let errorMessage = $state('')
   let infoMessage = $state('')
   let openRooms = $state([])
   let activeMessages = $state({})
   let leaderboard = $state([])
   let eloResults = $state([])
   let onlinePlayersList = $state([])
   let incomingInvite = $state(null)

   let showAuthModal = $state(false)
   let authMode = $state('login') // 'login' or 'register'
   let authEmail = $state('')
   let authPassword = $state('')
   let authPasswordConfirm = $state('')
   let authUsername = $state('')

   let gameState = $state({
      roomId: '',
      status: 'lobby',
      players: [],
      maxPlayers: 8,
      usedWords: [],
      currentTurnIndex: 0,
      currentPrefix: '',
      currentTypingWord: '',
      timeRemaining: 0,
      choosingPlayerId: null,
      difficulty: 1,
      hostId: null,
      prefixOptions: [],
      turnDirection: 1,
      skipNext: false,
      pausedBy: null,
      pauseTimestamp: null,
      settings: { lives: 3, timer: 15, combo: 5, items: true },
   })

   function connectSocket() {
      if (socket) {
         socket.disconnect()
         socket = null
      }

      // Stop execution here if there is no token.
      if (!pb.authStore.token) {
         return
      }

      // CRITICAL FIX 2: Append your custom namespace "/vocab-game" to the connection URL
      socket = io(`${socketDomain}/vocab-game`, {
         path: '/ws/vocab/',
         auth: {
            collectionName: pb.authStore.model?.collectionName || 'users',
            token: pb.authStore.token,
         },
      })

      socket.on('connect', () => {
         console.log('✅ Connected to /vocab-game namespace successfully!')
      })

      socket.on('vocab:online_players_update', (list) => {
         onlinePlayersList = list
      })

      socket.on('vocab:receive_invite', (data) => {
         incomingInvite = data
         setTimeout(() => {
            if (incomingInvite?.roomId === data.roomId) incomingInvite = null
         }, 15000)
      })

      socket.on('vocab:open_rooms_update', (roomsList) => {
         openRooms = roomsList
      })

      socket.on('vocab:leaderboard_update', (top10) => {
         leaderboard = top10
      })

      socket.on('vocab:state_update', (state) => {
         gameState = state
         if (state.status === 'lobby') view = 'lobby'
         if (state.status === 'starting') eloResults = []
         if (
            state.status === 'playing' ||
            state.status === 'choosing_prefix' ||
            state.status === 'paused' ||
            state.status === 'game_over'
         )
            view = 'game'
      })

      socket.on('vocab:typing_update', (data) => {
         if (gameState) gameState.currentTypingWord = data.word
      })

      socket.on('vocab:new_message', (data) => {
         activeMessages[data.playerId] = data.message
         setTimeout(() => {
            if (activeMessages[data.playerId] === data.message) {
               delete activeMessages[data.playerId]
            }
         }, 4000)
      })

      socket.on('vocab:info_message', (data) => {
         showInfo(data.message)
      })

      socket.on('vocab:elo_update', (results) => {
         eloResults = results
      })

      socket.on('vocab:error', (data) => {
         showError(data.message)
         if (data.message === 'Room not found!') {
            searchParams.delete('roomId')
         }
      })

      socket.on('connect_error', (err) => {
         console.error('Socket error:', err.message)
         if (err.message.includes('Vocab Auth Error')) {
            showError('Please log in to connect to the game server.')
         } else {
            showError('Failed to connect to the game server.')
         }
      })
   }

   onMount(() => {
      connectSocket()
      return () => {
         if (socket) socket.disconnect()
      }
   })

   // Helper function to extract specific Pocketbase errors
   function parsePocketbaseError(err) {
      if (err.response && err.response.data) {
         const errors = []
         const data = err.response.data

         if (data.username?.message) errors.push(`Username: ${data.username.message}`)
         if (data.email?.message) errors.push(`Email: ${data.email.message}`)
         if (data.password?.message) errors.push(`Password: ${data.password.message}`)
         if (data.passwordConfirm?.message)
            errors.push(`Confirm Password: ${data.passwordConfirm.message}`)

         if (errors.length > 0) return errors.join(' • ')
      }
      return err.message || 'An unknown error occurred.'
   }

   async function handleLogin(e) {
      e.preventDefault()
      try {
         await pb.collection('users').authWithPassword(authEmail, authPassword)
         current.user = pb.authStore.record
         showInfo(`Welcome back, ${current.user.username || 'Player'}!`)
         showAuthModal = false
         resetAuthFields()
         connectSocket()
      } catch (err) {
         showError(
            parsePocketbaseError(err) || 'Failed to log in. Check your credentials.'
         )
      }
   }

   async function handleRegister(e) {
      e.preventDefault()
      if (authPassword !== authPasswordConfirm) {
         return showError('Passwords do not match!')
      }
      try {
         await pb.collection('users').create({
            name: authUsername,
            email: authEmail,
            password: authPassword,
            passwordConfirm: authPasswordConfirm,
         })
         await pb.collection('users').authWithPassword(authEmail, authPassword)
         current.user = pb.authStore.record
         showInfo(`Account created! Welcome, ${current.user.username}!`)
         showAuthModal = false
         resetAuthFields()
         connectSocket()
      } catch (err) {
         showError(parsePocketbaseError(err))
      }
   }

   function handleLogout() {
      // Clear PocketBase auth first
      pb.authStore.clear()
      current.user = null

      // Disconnect the socket immediately so the server registers the disconnect event
      if (socket) {
         socket.disconnect()
         socket = null
      }

      // Reset local state to defaults
      view = 'home'
      gameState.roomId = ''
      openRooms = []
      onlinePlayersList = []
      searchParams.delete('roomId')

      showInfo('You have been logged out.')
   }

   function resetAuthFields() {
      authEmail = ''
      authPassword = ''
      authPasswordConfirm = ''
      authUsername = ''
   }

   function acceptInvite() {
      if (incomingInvite) {
         const targetRoom = incomingInvite.roomId
         incomingInvite = null
         if (gameState.roomId && gameState.roomId !== targetRoom) {
            handleLeaveRoom()
         }
         searchParams.set('roomId', targetRoom)
         if (view !== 'home') {
            handleJoinRoom(targetRoom, false)
         }
      }
   }

   function declineInvite() {
      if (incomingInvite && socket) {
         socket.emit('vocab:invite_response', {
            senderSocketId: incomingInvite.senderSocketId,
            status: 'declined',
         })
      }
      incomingInvite = null
   }

   function showError(msg) {
      errorMessage = msg
      setTimeout(() => (errorMessage = ''), 4000)
   }

   function showInfo(msg) {
      infoMessage = msg
      setTimeout(() => (infoMessage = ''), 4000)
   }

   function handleCreateRoom(maxPlayers, isSpectator) {
      if (socket) socket.emit('vocab:create_room', { maxPlayers, isSpectator })
   }

   function handleJoinRoom(roomId, isSpectator) {
      if (!String(roomId)) return showError('Please enter a room code.')
      if (socket) socket.emit('vocab:join_room', { roomId, isSpectator })
   }

   function handleStartGame() {
      if (socket) socket.emit('vocab:start')
   }

   function handleSubmitWord(word) {
      if (socket) socket.emit('vocab:submit_word', { word })
   }

   function handleSubmitPrefix(prefix) {
      if (socket) socket.emit('vocab:choose_prefix', { prefix })
   }

   function handleTyping(word) {
      if (socket) socket.emit('vocab:typing', { word })
   }

   function handleSendMessage(message) {
      if (socket) socket.emit('vocab:send_message', { message })
   }

   function handleUseSkill(skillType) {
      if (socket) socket.emit('vocab:use_skill', { skillType })
   }

   function handleLeaveRoom() {
      if (socket) socket.emit('vocab:leave_room')
      view = 'home'
      gameState.roomId = ''
      searchParams.delete('roomId')
   }

   function handleTogglePause() {
      if (socket) socket.emit('vocab:toggle_pause')
   }
</script>

<GameAudio {gameState} socketId={socket?.id} {socket} />

<main
   class="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans overflow-hidden selection:bg-indigo-500/30"
>
   <div class="absolute top-6 right-6 z-50 flex items-center gap-4">
      <!-- Only render the Login button if they are NOT logged in but they managed to close the modal (if applicable) -->
      {#if !current.user && !showAuthModal}
         <button
            class="bg-indigo-600 text-white font-black px-5 py-2.5 rounded-xl border-b-[4px] border-indigo-800 hover:bg-indigo-500 active:translate-y-[4px] active:border-b-0 transition-all text-sm uppercase tracking-wider"
            onclick={() => {
               showAuthModal = true
               authMode = 'login'
            }}
         >
            Log In
         </button>
      {/if}
   </div>

   <div
      class="absolute inset-0 z-0 pointer-events-none opacity-[0.15]"
      style="background-image: radial-gradient(circle, #94a3b8 1px, transparent 1px); background-size: 24px 24px;"
   ></div>
   <div
      class="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950/80 to-slate-950"
   ></div>

   <div
      class="relative z-10 w-full flex flex-col font-[inter] items-center justify-center h-full px-4"
   >
      {#if errorMessage}
         <div class="toast toast-top toast-center z-[100] mt-4 max-w-[90vw]">
            <div
               class="alert bg-slate-900/90 border-l-4 border-red-500 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.2)] backdrop-blur-md rounded-lg px-6 py-4 flex items-start gap-3"
            >
               <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="stroke-current shrink-0 h-6 w-6 text-red-500 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  ><path
                     stroke-linecap="round"
                     stroke-linejoin="round"
                     stroke-width="2"
                     d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  /></svg
               >
               <!-- Text wraps nicely for long detailed pocketbase errors -->
               <span class="font-bold tracking-wide text-sm leading-relaxed"
                  >{errorMessage}</span
               >
            </div>
         </div>
      {/if}

      {#if infoMessage}
         <div class="toast toast-top toast-center z-[100] mt-4 animate-bounce">
            <div
               class="alert bg-linear-to-r from-indigo-900/90 to-purple-900/90 border-l-4 border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.4)] backdrop-blur-md rounded-lg px-6 py-4 flex items-center gap-3"
            >
               <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="stroke-current shrink-0 h-6 w-6 text-indigo-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  ><path
                     stroke-linecap="round"
                     stroke-linejoin="round"
                     stroke-width="2"
                     d="M13 10V3L4 14h7v7l9-11h-7z"
                  /></svg
               >
               <span
                  class="font-bold uppercase tracking-wider text-transparent bg-clip-text bg-linear-to-r from-indigo-200 to-white"
                  >{infoMessage}</span
               >
            </div>
         </div>
      {/if}

      <!-- Replaced the fixed overlay with an inline conditional render: -->
      <!-- If the user is unauthenticated OR the Auth modal is triggered, show ONLY the Auth UI -->
      {#if showAuthModal || !current.user}
         <div
            class="bg-white rounded-[2rem] p-8 shadow-2xl border-4 border-slate-100 w-full max-w-md animate-in zoom-in-95 fade-in duration-200 flex flex-col gap-6 relative text-slate-800 my-8"
         >
            <!-- Only show close button if the user is actually logged in and just explicitly requested the modal -->
            {#if current.user}
               <button
                  class="absolute top-5 right-6 text-slate-400 hover:text-slate-600 font-bold text-xl transition-colors"
                  onclick={() => (showAuthModal = false)}>✕</button
               >
            {/if}

            <div class="text-center mt-2">
               <div
                  class="w-16 h-16 rounded-2xl bg-indigo-100 border-4 border-indigo-200 flex items-center justify-center text-3xl mx-auto mb-4 shadow-sm"
               >
                  {authMode === 'login' ? '🔐' : '✨'}
               </div>
               <h3
                  class="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none mb-2"
               >
                  {authMode === 'login' ? 'Welcome Back!' : 'Join the Arena'}
               </h3>
               <p class="text-sm font-bold text-slate-400 uppercase tracking-wide">
                  {authMode === 'login'
                     ? 'Log in to save your stats.'
                     : 'Create an account to start ranking up.'}
               </p>
            </div>

            <form
               class="flex flex-col gap-3"
               onsubmit={authMode === 'login' ? handleLogin : handleRegister}
            >
               {#if authMode === 'register'}
                  <input
                     type="text"
                     placeholder="Username"
                     bind:value={authUsername}
                     required
                     class="bg-slate-100 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:border-indigo-500 font-bold transition-colors"
                  />
               {/if}
               <input
                  type="email"
                  placeholder="Email Address"
                  bind:value={authEmail}
                  required
                  class="bg-slate-100 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:border-indigo-500 font-bold transition-colors"
               />
               <input
                  type="password"
                  placeholder="Password"
                  bind:value={authPassword}
                  required
                  class="bg-slate-100 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:border-indigo-500 font-bold transition-colors"
               />
               {#if authMode === 'register'}
                  <input
                     type="password"
                     placeholder="Confirm Password"
                     bind:value={authPasswordConfirm}
                     required
                     class="bg-slate-100 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:border-indigo-500 font-bold transition-colors"
                  />
               {/if}

               <button
                  type="submit"
                  class="w-full bg-indigo-500 text-white font-black py-4 rounded-xl border-b-[4px] border-indigo-700 hover:bg-indigo-400 active:translate-y-[4px] active:border-b-0 uppercase transition-all mt-2"
               >
                  {authMode === 'login' ? 'Log In' : 'Sign Up'}
               </button>
            </form>

            <p class="text-center text-sm font-bold text-slate-400 uppercase">
               {authMode === 'login'
                  ? "Don't have an account?"
                  : 'Already have an account?'}
               <button
                  class="text-indigo-500 hover:text-indigo-600 transition-colors ml-1"
                  onclick={() => {
                     authMode = authMode === 'login' ? 'register' : 'login'
                     resetAuthFields()
                  }}
               >
                  {authMode === 'login' ? 'Sign up' : 'Log in'}
               </button>
            </p>
         </div>

         <!-- If they are authenticated, render the standard game views -->
      {:else}
         {#if view === 'home'}
            <Home
               {openRooms}
               {onlinePlayersList}
               {socket}
               {leaderboard}
               onCreateRoom={handleCreateRoom}
               onJoinRoom={handleJoinRoom}
               onLogout={handleLogout}
            />
         {:else if view === 'lobby'}
            <Lobby
               {gameState}
               socketId={socket?.id}
               {onlinePlayersList}
               {socket}
               {activeMessages}
               {handleSendMessage}
               onStartGame={handleStartGame}
               onLeaveRoom={handleLeaveRoom}
               {showError}
            />
         {:else if view === 'game'}
            <Game
               {gameState}
               socketId={socket?.id}
               {socket}
               {activeMessages}
               {eloResults}
               {handleSubmitWord}
               {handleSubmitPrefix}
               {handleTyping}
               {handleSendMessage}
               {handleUseSkill}
               {handleTogglePause}
               onLeaveRoom={handleLeaveRoom}
               {showError}
            />
         {/if}
      {/if}
   </div>

   <!-- Invites remain absolutely positioned over everything else -->
   {#if incomingInvite}
      <div
         class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4"
      >
         <div
            class="bg-white rounded-[2rem] p-8 shadow-2xl border-4 border-slate-100 w-full max-w-sm animate-in zoom-in-95 fade-in duration-200 text-center flex flex-col gap-6"
         >
            <div>
               <div
                  class="w-16 h-16 rounded-2xl bg-indigo-100 border-4 border-indigo-200 flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce shadow-sm"
               >
                  💌
               </div>
               <h3
                  class="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none mb-2"
               >
                  Arena Invite!
               </h3>
               <p
                  class="text-sm font-bold text-slate-400 uppercase tracking-wide leading-relaxed"
               >
                  <span class="text-indigo-500">{incomingInvite.hostName}</span> has challenged
                  you to a battle.
               </p>
            </div>
            <div class="flex gap-3">
               <button
                  class="flex-1 bg-slate-200 text-slate-600 font-black py-3 rounded-xl border-b-[4px] border-slate-300 hover:bg-slate-100 active:translate-y-[4px] active:border-b-0 uppercase transition-all"
                  onclick={declineInvite}>Decline</button
               >
               <button
                  class="flex-1 bg-indigo-500 text-white font-black py-3 rounded-xl border-b-[4px] border-indigo-700 hover:bg-indigo-400 active:translate-y-[4px] active:border-b-0 uppercase transition-all"
                  onclick={acceptInvite}>Accept</button
               >
            </div>
         </div>
      </div>
   {/if}
</main>
