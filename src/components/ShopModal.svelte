<script>
   import { SHOP_BORDERS } from './Border'
   import Avatar from './Avatar.svelte'
   import { current, pb } from '../scripts/Pocketbase.svelte'

   let { onClose, socket } = $props()

   let user = $derived(current.user)
   let inventory = $state(user?.inventory || { borders: [], titles: [] })
   let equipment = $state(user?.equipment || { border: null, title: null })
   let elo = $state(user?.elo || 1000)

   async function handleBuy(item) {
      if (elo < item.price) return alert('Not enough ELO to purchase this item!')

      elo -= item.price
      inventory.borders.push(item.id)

      const updatedRecord = await pb.collection(user.collectionName).update(user.id, {
         elo,
         inventory,
      })
      current.user = updatedRecord
   }

   async function handleEquip(item) {
      equipment.border = equipment.border === item.id ? null : item.id

      const updatedRecord = await pb
         .collection(user.collectionName)
         .update(user.id, { equipment }, { requestKey: null })
      current.user = updatedRecord

      if (socket) {
         socket.emit('vocab:equip_item', equipment)
      }
   }
</script>

<!-- CRITICAL FIX: Missing '>' bracket fixed -->
<div
   class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 md:p-6"
>
   <div
      class="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-[0_12px_0_0_rgba(148,163,184,0.4)] border-4 border-slate-100 w-full max-w-5xl animate-in zoom-in-95 fade-in duration-200 flex flex-col max-h-[90vh]"
   >
      <div class="flex justify-between items-center mb-6 relative shrink-0">
         <button
            class="absolute top-0 left-0 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-500 p-3 rounded-2xl transition-all shadow-sm z-10"
            onclick={onClose}
            title="Close Shop"
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
                  d="M6 18L18 6M6 6l12 12"
               />
            </svg>
         </button>
         <h2
            class="text-4xl font-black text-slate-800 tracking-tight flex-1 text-center uppercase"
         >
            Arena <span class="text-emerald-500">Shop</span>
         </h2>
         <div class="absolute top-0 right-0 hidden sm:flex">
            <span
               class="bg-indigo-50 text-indigo-500 border-2 border-indigo-200 text-sm font-black px-4 py-3 rounded-2xl uppercase tracking-wider shadow-sm flex items-center gap-2"
            >
               ELO <span class="text-indigo-700 text-lg leading-none"
                  >{Math.round(elo)}</span
               >
            </span>
         </div>
      </div>
      <div class="sm:hidden flex justify-center mb-6 shrink-0">
         <span
            class="bg-indigo-50 text-indigo-500 border-2 border-indigo-200 text-sm font-black px-4 py-2 rounded-xl uppercase tracking-wider shadow-sm flex items-center gap-2"
         >
            ELO <span class="text-indigo-700 text-base leading-none"
               >{Math.round(elo)}</span
            >
         </span>
      </div>
      <div
         class="flex-1 overflow-y-auto playful-scrollbar bg-slate-50 border-4 border-slate-100 rounded-[2rem] p-4 md:p-6 shadow-inner"
      >
         <div
            class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 content-start h-auto"
         >
            {#each SHOP_BORDERS as item}
               {@const isOwned = inventory.borders.includes(item.id)}
               {@const isEquipped = equipment.border === item.id}
               <div
                  class="bg-white border-4 border-slate-200 rounded-[2rem] p-4 md:p-5 flex flex-col items-center text-center shadow-[0_6px_0_0_rgba(226,232,240,1)] relative transition-transform hover:-translate-y-1 hover:shadow-[0_10px_0_0_rgba(226,232,240,1)] duration-200"
               >
                  <div class="mb-3 mt-1 shrink-0">
                     <Avatar
                        player={{
                           ...user,
                           dbId: user?.id,
                           equipment: { border: item.id },
                        }}
                        className="w-10 h-10"
                     />
                  </div>
                  <h4
                     class="font-black text-slate-700 text-lg uppercase tracking-tight line-clamp-1 w-full"
                  >
                     {item.name}
                  </h4>
                  <span
                     class="bg-slate-100 text-slate-400 text-[10px] font-black uppercase px-3 py-1 rounded-xl mb-4 mt-1 border-2 border-slate-200"
                  >
                     Cosmetic
                  </span>
                  <div class="w-full mt-auto">
                     {#if isOwned}
                        <button
                           class="w-full font-black py-3 rounded-2xl uppercase transition-all border-b-[4px] text-sm {isEquipped
                              ? 'bg-amber-400 text-white border-amber-600 hover:bg-amber-300 hover:translate-y-[2px] hover:border-b-[2px] active:translate-y-[4px] active:border-b-0'
                              : 'bg-slate-200 text-slate-500 border-slate-400 hover:bg-slate-300 hover:translate-y-[2px] hover:border-b-[2px] active:translate-y-[4px] active:border-b-0'}"
                           onclick={() => handleEquip(item)}
                        >
                           {isEquipped ? 'Unequip' : 'Equip'}
                        </button>
                     {:else}
                        <button
                           class="w-full bg-emerald-500 text-white font-black py-3 rounded-2xl border-b-[4px] border-emerald-700 hover:bg-emerald-400 hover:translate-y-[2px] hover:border-b-[2px] active:translate-y-[4px] active:border-b-0 uppercase transition-all text-sm flex items-center justify-center gap-1"
                           onclick={() => handleBuy(item)}
                        >
                           Buy <span
                              class="bg-emerald-700/30 px-2 py-0.5 rounded-lg text-xs ml-1"
                              >{item.price}</span
                           >
                        </button>
                     {/if}
                  </div>
               </div>
            {/each}
         </div>
      </div>
   </div>
</div>

<style>
   .playful-scrollbar::-webkit-scrollbar {
      width: 8px;
   }
   .playful-scrollbar::-webkit-scrollbar-track {
      background: #f8fafc;
      border-radius: 12px;
   }
   .playful-scrollbar::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 12px;
      border: 2px solid #f8fafc;
   }
</style>
