<script>
   import { searchParams } from 'sv-router'
   import ShopModal from './ShopModal.svelte'
   import ProfileModal from './ProfileModal.svelte'
   import Avatar from './Avatar.svelte'
   import { current } from '../scripts/Pocketbase.svelte'

   let {
      socket,
      openRooms = [],
      leaderboard = [],
      onlinePlayersList = [],
      onCreateRoom,
      onJoinRoom,
      onLogout,
   } = $props()

   let joinRoomCode = $state('')
   let maxPlayers = $state(4)
   let isSpectator = $state(false)
   let showShop = $state(false)
   let showProfile = $state(false)

   // --- FILTERS STATE ---
   let statusFilter = $state('all') // 'all' | 'open' | 'live'
   let modeFilter = $state('all') // 'all' | 'classic' | 'shared_prefix'

   const MIN_PLAYERS = 2
   const MAX_PLAYERS = 8

   const roomId = $derived(searchParams.get('roomId'))

   // Dynamically filter openRooms based on active filters
   const filteredRooms = $derived(
      (openRooms || []).filter((room) => {
         // Status Filter
         if (statusFilter === 'open' && room.inProgress) return false
         if (statusFilter === 'live' && !room.inProgress) return false

         // Game Mode Filter
         if (modeFilter !== 'all' && room.settings?.gameMode !== modeFilter) return false

         return true
      })
   )

   function clampMaxPlayers() {
      let val = parseInt(maxPlayers, 10)
      if (!Number.isFinite(val)) val = 4
      maxPlayers = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, val))
   }

   $effect(() => {
      if (roomId && socket) {
         onJoinRoom(roomId, isSpectator)
      }
   })

   const getRankStyle = (index) => {
      if (index === 0)
         return 'bg-amber-400 text-slate-950 border-amber-500 shadow-[0_2px_0_0_#d97706]'
      if (index === 1)
         return 'bg-slate-300 text-slate-800 border-slate-400 shadow-[0_2px_0_0_#94a3b8]'
      if (index === 2)
         return 'bg-amber-700 text-white border-amber-800 shadow-[0_2px_0_0_#78350f]'
      return 'bg-slate-100 text-slate-500 border-slate-200 shadow-[0_2px_0_0_#e2e8f0]'
   }
</script>

<div
   class="lg:h-[100dvh] w-full max-w-6xl mx-auto p-3 md:p-4 flex flex-col gap-3 lg:gap-4 overflow-y-auto lg:overflow-hidden"
>
   <div class="flex flex-col lg:flex-row gap-3 lg:gap-4 shrink-0 lg:h-[48%] min-h-0">
      <!-- CREATE / JOIN ROOM -->
      <div
         class="w-full lg:flex-1 relative bg-white rounded-3xl p-4 md:p-5 shadow-[0_8px_0_0_rgba(148,163,184,0.4)] border-4 border-slate-100 h-full flex flex-col justify-center"
      >
         <!-- PROFILE & SHOP BUTTONS GROUP -->
         {#if current.user}
            <div class="absolute top-4 right-4 z-20 flex items-center gap-2">
               <button
                  class="bg-slate-100 text-slate-500 w-10 h-10 flex items-center justify-center rounded-[0.8rem] hover:bg-slate-200 transition-colors shadow-sm"
                  onclick={() => (showProfile = true)}
                  title="Player Profile"
               >
                  <svg
                     xmlns="http://www.w3.org/2000/svg"
                     class="h-[1.1rem] w-[1.1rem]"
                     viewBox="0 0 20 20"
                     fill="currentColor"
                  >
                     <path
                        fill-rule="evenodd"
                        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                        clip-rule="evenodd"
                     />
                  </svg>
               </button>
               <button
                  class="bg-emerald-100 text-emerald-600 px-4 py-2 text-[13px] font-bold rounded-[0.8rem] hover:bg-emerald-200 transition-colors shadow-sm"
                  onclick={() => (showShop = true)}
                  title="Open Shop"
               >
                  Shop
               </button>
            </div>
         {/if}

         <h2
            class="text-3xl md:text-4xl font-black text-center mb-4 text-slate-800 tracking-tight drop-shadow-sm mt-2 lg:mt-0"
         >
            WORD <span class="text-rose-500">Arena</span>
         </h2>
         <div
            class="text-center mb-4 text-slate-500 font-bold uppercase tracking-widest text-xs"
         >
            <span
               class="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-1"
            ></span>
            {onlinePlayersList.length} Players Online
         </div>

         <!-- MODALS -->
         {#if showShop && current.user}
            <ShopModal {socket} onClose={() => (showShop = false)} />
         {/if}

         {#if showProfile && current.user}
            <ProfileModal onClose={() => (showProfile = false)} {onLogout} {socket} />
         {/if}

         <div class="w-full mb-3">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label
               class="block text-slate-400 font-extrabold text-xs uppercase tracking-wider mb-1 ml-2"
            >
               Capacity ({MIN_PLAYERS} - {MAX_PLAYERS})
            </label>
            <input
               type="number"
               min={MIN_PLAYERS}
               max={MAX_PLAYERS}
               bind:value={maxPlayers}
               onblur={clampMaxPlayers}
               class="w-full bg-slate-100 border-4 border-slate-100 text-slate-700 text-xl font-black text-center rounded-xl py-2 focus:outline-none focus:border-rose-300 focus:bg-white transition-colors shadow-inner"
            />
         </div>
         <div
            class="flex items-center justify-between bg-slate-50 border-4 border-slate-100 p-3 rounded-xl mb-4"
         >
            <span class="font-black text-slate-500 uppercase text-xs"
               >Join as Spectator</span
            >
            <input
               type="checkbox"
               class="toggle toggle-info toggle-sm"
               bind:checked={isSpectator}
            />
         </div>
         <button
            class="w-full bg-rose-500 text-white font-black text-lg py-3 mb-4 rounded-xl border-b-[4px] border-rose-700 hover:bg-rose-400 hover:translate-y-[2px] hover:border-b-[2px] active:translate-y-[4px] active:border-b-0 transition-all duration-100"
            onclick={() => {
               clampMaxPlayers()
               onCreateRoom(maxPlayers, isSpectator)
            }}
         >
            CREATE ROOM
         </button>
         <div class="flex gap-2 mt-auto">
            <input
               type="text"
               placeholder="CODE"
               maxlength="4"
               bind:value={joinRoomCode}
               onkeydown={(e) =>
                  e.key === 'Enter' && onJoinRoom(joinRoomCode, isSpectator)}
               class="w-full bg-slate-100 border-4 border-slate-100 text-slate-700 text-lg font-black text-center uppercase tracking-[0.2em] rounded-xl py-2 focus:outline-none focus:border-blue-300 focus:bg-white transition-colors shadow-inner placeholder:text-slate-300"
            />
            <button
               class="whitespace-nowrap bg-blue-500 text-white font-black text-base px-5 rounded-xl border-b-[4px] border-blue-700 hover:bg-blue-400 hover:translate-y-[2px] hover:border-b-[2px] active:translate-y-[4px] active:border-b-0 transition-all duration-100"
               onclick={() => onJoinRoom(joinRoomCode, isSpectator)}
            >
               JOIN
            </button>
         </div>
      </div>

      <!-- LEADERBOARD -->
      <div
         class="w-full lg:flex-1 bg-white rounded-3xl p-4 md:p-5 shadow-[0_8px_0_0_rgba(148,163,184,0.4)] border-4 border-slate-100 h-full flex flex-col min-h-0"
      >
         <h2
            class="text-2xl md:text-3xl font-black text-center mb-4 text-slate-800 tracking-tight drop-shadow-sm"
         >
            TOP <span class="text-amber-500"> CHALLENGERS </span>
         </h2>
         <div
            class="w-full flex flex-col gap-2 overflow-y-auto pr-2 playful-scrollbar flex-1 min-h-0"
         >
            {#if !leaderboard || leaderboard.length === 0}
               <div
                  class="flex flex-col items-center justify-center h-full min-h-[120px] py-6 bg-slate-50 rounded-2xl border-4 border-dashed border-slate-200 text-slate-400 flex-grow"
               >
                  <svg
                     xmlns="http://www.w3.org/2000/svg"
                     class="h-8 w-8 mb-2 opacity-50"
                     fill="none"
                     viewBox="0 0 24 24"
                     stroke="currentColor"
                  >
                     <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="3"
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z"
                     />
                  </svg>
                  <span class="text-xs font-extrabold tracking-wide">NO RANKINGS YET</span
                  >
               </div>
            {:else}
               {#each leaderboard as user, index}
                  <div
                     class="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border-2 border-slate-100 hover:bg-slate-100/50 transition-colors duration-100"
                  >
                     <div class="flex items-center gap-2.5">
                        <div
                           class="w-7 h-7 flex items-center justify-center rounded-lg border-2 font-black text-sm shrink-0 {getRankStyle(
                              index
                           )}"
                        >
                           {index + 1}
                        </div>
                        <span
                           class="font-extrabold text-slate-700 text-sm truncate max-w-[140px]"
                           >{user.name}</span
                        >
                     </div>
                     <div
                        class="bg-white px-2.5 py-1 rounded-lg border-2 border-slate-200 shadow-sm flex items-center shrink-0"
                     >
                        <span class="text-slate-800 font-black text-xs tracking-wide">
                           {Math.round(user.elo)}
                           <span class="text-[10px] text-slate-400 font-bold ml-0.5"
                              >ELO</span
                           >
                        </span>
                     </div>
                  </div>
               {/each}
            {/if}
         </div>
      </div>
   </div>

   <!-- BOTTOM HALF -->
   <div class="flex flex-col lg:flex-row gap-3 lg:gap-4 flex-1 min-h-0">
      <!-- PUBLIC ARENAS -->
      <div
         class="w-full lg:flex-[2] bg-white rounded-3xl p-4 md:p-5 shadow-[0_8px_0_0_rgba(148,163,184,0.4)] border-4 border-slate-100 flex flex-col min-h-0"
      >
         <!-- HEADER & FILTERS BAR -->
         <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 shrink-0"
         >
            <h2
               class="text-xl md:text-2xl font-black text-slate-800 tracking-tight drop-shadow-sm uppercase whitespace-nowrap"
            >
               Public <span class="text-blue-500">Arenas</span>
            </h2>

            <!-- FILTER CONTROLS -->
            <div class="flex flex-wrap items-center gap-1.5 shrink-0">
               <!-- Status Filter Pills -->
               <div
                  class="flex items-center bg-slate-100 p-1 rounded-xl border-2 border-slate-100 gap-1"
               >
                  <button
                     class="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-lg transition-all {statusFilter ===
                     'all'
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'}"
                     onclick={() => (statusFilter = 'all')}
                  >
                     All Status
                  </button>
                  <button
                     class="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-lg transition-all {statusFilter ===
                     'open'
                        ? 'bg-amber-400 text-slate-900 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'}"
                     onclick={() => (statusFilter = 'open')}
                  >
                     Open
                  </button>
                  <button
                     class="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-lg transition-all {statusFilter ===
                     'live'
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'}"
                     onclick={() => (statusFilter = 'live')}
                  >
                     Live
                  </button>
               </div>

               <!-- Game Mode Filter Pills -->
               <div
                  class="flex items-center bg-slate-100 p-1 rounded-xl border-2 border-slate-100 gap-1"
               >
                  <button
                     class="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-lg transition-all {modeFilter ===
                     'all'
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'}"
                     onclick={() => (modeFilter = 'all')}
                  >
                     All Modes
                  </button>
                  <button
                     class="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-lg transition-all {modeFilter ===
                     'classic'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'}"
                     onclick={() => (modeFilter = 'classic')}
                  >
                     Classic
                  </button>
                  <button
                     class="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-lg transition-all {modeFilter ===
                     'shared_prefix'
                        ? 'bg-purple-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'}"
                     onclick={() => (modeFilter = 'shared_prefix')}
                  >
                     Round Robin
                  </button>
               </div>
            </div>
         </div>

         <!-- ROOMS LIST -->
         <div
            class="w-full {filteredRooms.length > 0
               ? 'grid grid-cols-1 md:grid-cols-2 gap-3 content-start items-start'
               : 'flex flex-col'} flex-1 min-h-0 overflow-y-auto pr-2 playful-scrollbar"
         >
            {#if filteredRooms.length === 0}
               <div
                  class="flex flex-col items-center justify-center py-8 w-full bg-slate-50 rounded-2xl border-4 border-dashed border-slate-200 text-slate-400 flex-1"
               >
                  <svg
                     xmlns="http://www.w3.org/2000/svg"
                     class="h-8 w-8 mb-2 opacity-50"
                     fill="none"
                     viewBox="0 0 24 24"
                     stroke="currentColor"
                  >
                     <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="3"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                     />
                  </svg>
                  <span class="text-xs font-extrabold tracking-wide uppercase">
                     {openRooms.length === 0 ? 'No Arenas Found' : 'No Matching Arenas'}
                  </span>
               </div>
            {:else}
               {#each filteredRooms as room}
                  <div
                     class="group flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border-4 {room.inProgress
                        ? 'border-indigo-100 hover:border-indigo-200 hover:shadow-[0_4px_0_0_rgba(199,210,254,1)]'
                        : 'border-slate-100 hover:border-blue-200 hover:shadow-[0_4px_0_0_rgba(191,219,254,1)]'} hover:bg-white hover:-translate-y-1 transition-all duration-150 h-auto"
                  >
                     <div class="flex-1 min-w-0 w-full flex flex-col justify-center">
                        <div
                           class="text-base font-extrabold text-slate-700 group-hover:text-blue-600 transition-colors truncate"
                        >
                           {room.hostName}'s Arena
                        </div>
                        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                           {#if room.inProgress}
                              <span
                                 class="flex items-center gap-1 text-indigo-600 bg-indigo-100 border-2 border-indigo-200 px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest animate-pulse shrink-0"
                              >
                                 Live
                              </span>
                           {/if}
                           <span
                              class="text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded-lg border-2 border-blue-200 uppercase tracking-widest text-[9px] font-black shrink-0"
                           >
                              {room.roomId}
                           </span>
                           <span
                              class="flex items-center gap-1 text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-lg border-2 border-slate-200 text-[9px] font-black shrink-0"
                           >
                              <svg
                                 xmlns="http://www.w3.org/2000/svg"
                                 class="h-3 w-3"
                                 viewBox="0 0 20 20"
                                 fill="currentColor"
                              >
                                 <path
                                    fill-rule="evenodd"
                                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                    clip-rule="evenodd"
                                 />
                              </svg>
                              {room.playerCount}/{room.maxPlayers}
                           </span>
                           {#if room.settings}
                              <span
                                 class="text-amber-600 bg-amber-100 border-2 border-amber-200 px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase shrink-0"
                              >
                                 {room.settings.teamMode}
                              </span>
                              <span
                                 class="{room.settings.gameMode === 'shared_prefix'
                                    ? 'text-purple-600 bg-purple-100 border-purple-200'
                                    : 'text-emerald-600 bg-emerald-100 border-emerald-200'} border-2 px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wide shrink-0"
                              >
                                 {room.settings.gameMode === 'shared_prefix'
                                    ? 'Round Robin'
                                    : 'Classic'}
                              </span>
                              <span
                                 class="text-rose-500 bg-rose-100 border-2 border-rose-200 px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase shrink-0"
                              >
                                 {room.settings.timer}s
                              </span>
                              <span
                                 class="text-indigo-500 bg-indigo-100 border-2 border-indigo-200 px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase shrink-0"
                              >
                                 Min {room.settings.minLetters || 2}L
                              </span>
                              {#if room.settings.noBaseRepetition}
                                 <span
                                    class="text-amber-600 bg-amber-100 border-2 border-amber-200 px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase shrink-0"
                                    >Strict Base</span
                                 >
                              {/if}
                              {#if room.settings.diminishingTime}
                                 <span
                                    class="text-orange-600 bg-orange-100 border-2 border-orange-200 px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase shrink-0"
                                    >-3s Pen</span
                                 >
                              {/if}
                           {/if}
                        </div>
                     </div>
                     {#if room.inProgress}
                        <button
                           class="w-full xl:w-auto shrink-0 bg-indigo-500 text-white font-black text-xs px-4 py-2 rounded-xl border-b-[3px] border-indigo-700 hover:bg-indigo-400 hover:translate-y-[1px] hover:border-b-[2px] active:translate-y-[3px] active:border-b-0 transition-all duration-100"
                           onclick={() => onJoinRoom(room.roomId, true)}
                        >
                           WATCH
                        </button>
                     {:else}
                        <button
                           class="w-full xl:w-auto shrink-0 bg-amber-400 text-slate-800 font-black text-xs px-4 py-2 rounded-xl border-b-[3px] border-amber-600 hover:bg-amber-300 hover:translate-y-[1px] hover:border-b-[2px] active:translate-y-[3px] active:border-b-0 transition-all duration-100"
                           onclick={() => onJoinRoom(room.roomId, isSpectator)}
                        >
                           JOIN
                        </button>
                     {/if}
                  </div>
               {/each}
            {/if}
         </div>
      </div>

      <!-- ONLINE FIGHTERS -->
      <div
         class="w-full lg:flex-1 bg-white rounded-3xl p-4 md:p-5 shadow-[0_8px_0_0_rgba(148,163,184,0.4)] border-4 border-slate-100 flex flex-col min-h-0"
      >
         <div class="flex items-center gap-3 mb-3">
            <h2
               class="text-xl md:text-2xl font-black text-slate-800 tracking-tight drop-shadow-sm uppercase whitespace-nowrap"
            >
               Online <span class="text-emerald-500">Fighters</span>
            </h2>
            <div class="flex-grow border-t-4 border-dashed border-slate-200 mt-1"></div>
            <span
               class="bg-emerald-100 text-emerald-600 border-2 border-emerald-200 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shrink-0 animate-pulse"
            >
               {onlinePlayersList.length} Active
            </span>
         </div>
         <div
            class="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 playful-scrollbar pr-2"
         >
            {#if onlinePlayersList.length === 0}
               <div
                  class="w-full h-full flex items-center justify-center text-center py-6 text-slate-400 font-bold uppercase tracking-wide text-xs"
               >
                  It's quiet... too quiet.
               </div>
            {:else}
               {#each onlinePlayersList as player}
                  <div
                     class="flex items-center gap-2 bg-slate-50 border-2 border-slate-100 px-3 py-2 rounded-xl shadow-sm hover:bg-white hover:border-slate-200 hover:-translate-y-1 transition-all"
                  >
                     <Avatar {player} className="w-5 h-5 mr-3" />
                     <span
                        class="font-extrabold text-slate-700 uppercase tracking-wide text-xs truncate"
                     >
                        {player.name}
                     </span>
                  </div>
               {/each}
            {/if}
         </div>
      </div>
   </div>
</div>

<style>
   .playful-scrollbar::-webkit-scrollbar {
      width: 8px;
   }
   .playful-scrollbar::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 12px;
   }
   .playful-scrollbar::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 12px;
      border: 2px solid #f1f5f9;
   }
   .playful-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
   }
</style>
