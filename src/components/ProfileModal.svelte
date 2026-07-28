<script>
   import { current, pb } from '../scripts/Pocketbase.svelte'
   import Avatar from './Avatar.svelte'

   let { onClose, onLogout } = $props()

   let user = $derived(current.user)
   let isUploading = $state(false)

   // --- Edit Profile States ---
   let isEditing = $state(false)
   let isSaving = $state(false)
   let errorMessage = $state('')
   let successMessage = $state('')

   // --- Form Field ---
   let name = $state('')

   function startEditing() {
      name = user?.name || user?.username || ''
      errorMessage = ''
      successMessage = ''
      isEditing = true
   }

   function cancelEditing() {
      isEditing = false
      errorMessage = ''
   }

   async function handleAvatarUpload(e) {
      const file = e.target.files[0]
      if (!file) return

      try {
         isUploading = true
         const formData = new FormData()
         formData.append('avatar', file)

         // Upload to PocketBase
         const updatedRecord = await pb
            .collection(user.collectionName)
            .update(user.id, formData)

         // Update global state
         current.user = updatedRecord
      } catch (err) {
         console.error('Avatar upload failed:', err)
         alert('Failed to upload avatar')
      } finally {
         isUploading = false
      }
   }

   async function handleSaveProfile(e) {
      e.preventDefault()
      errorMessage = ''
      successMessage = ''

      try {
         isSaving = true

         // Update only the name field in PocketBase
         const updatedRecord = await pb
            .collection(user.collectionName)
            .update(user.id, { name })

         current.user = updatedRecord
         successMessage = 'Name updated successfully!'
         isEditing = false
      } catch (err) {
         console.error('Profile update failed:', err)
         errorMessage = err?.message || 'Failed to update name.'
      } finally {
         isSaving = false
      }
   }
</script>

<div
   class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
>
   <div
      class="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-[0_12px_0_0_rgba(148,163,184,0.4)] border-4 border-slate-100 w-full max-w-sm animate-in zoom-in-95 fade-in duration-200 relative flex flex-col items-center"
   >
      <!-- Top Left Close Button -->
      <button
         class="absolute top-5 left-5 bg-slate-100 hover:bg-slate-200 text-slate-500 w-10 h-10 flex items-center justify-center rounded-2xl transition-all shadow-sm z-10"
         onclick={onClose}
         title="Close"
      >
         <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
         >
            <path
               fill-rule="evenodd"
               d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
               clip-rule="evenodd"
            />
         </svg>
      </button>

      <h2
         class="text-2xl font-black text-slate-800 tracking-tight text-center uppercase mt-1"
      >
         Player <span class="text-indigo-500">Profile</span>
      </h2>

      <!-- Feedback Messages -->
      {#if successMessage}
         <div
            class="mt-3 w-full bg-emerald-50 border-2 border-emerald-200 text-emerald-600 text-xs font-bold p-3 rounded-2xl text-center"
         >
            {successMessage}
         </div>
      {/if}

      {#if errorMessage}
         <div
            class="mt-3 w-full bg-rose-50 border-2 border-rose-200 text-rose-600 text-xs font-bold p-3 rounded-2xl text-center"
         >
            {errorMessage}
         </div>
      {/if}

      <!-- Inner Card -->
      <div
         class="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-5 mt-4 flex flex-col items-center shadow-inner relative"
      >
         <!-- Avatar Header -->
         <div class="relative">
            <Avatar player={{ ...user, dbId: user.id }} className="w-24 h-24" />

            <!-- Upload Avatar Button -->
            <label
               class="absolute z-20 bottom-0 right-0 w-8 h-8 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md transition-colors border-2 border-white {isUploading
                  ? 'opacity-50 pointer-events-none'
                  : ''}"
               title="Upload new Avatar"
            >
               {#if isUploading}
                  <span
                     class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                  ></span>
               {:else}
                  <svg
                     xmlns="http://www.w3.org/2000/svg"
                     class="h-4 w-4"
                     viewBox="0 0 20 20"
                     fill="currentColor"
                  >
                     <path
                        d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
                     />
                  </svg>
               {/if}
               <input
                  type="file"
                  accept="image/png, image/jpeg, image/gif, image/webp"
                  class="hidden"
                  onchange={handleAvatarUpload}
                  disabled={isUploading}
               />
            </label>
         </div>

         <!-- VIEW MODE -->
         {#if !isEditing}
            <h3
               class="font-black text-slate-800 text-xl mt-4 uppercase tracking-wider line-clamp-1 text-center"
            >
               {user.name || user.username || 'Player'}
            </h3>
            <p
               class="font-bold text-slate-400 text-[10px] uppercase tracking-widest truncate max-w-full text-center mt-0.5"
            >
               {user.email}
            </p>

            <!-- EDIT MODE FORM -->
         {:else}
            <form onsubmit={handleSaveProfile} class="w-full mt-4 flex flex-col gap-3">
               <div>
                  <label
                     for="profile-name"
                     class="block text-[11px] font-black uppercase text-slate-500 tracking-wider mb-1"
                  >
                     Display Name
                  </label>
                  <input
                     id="profile-name"
                     type="text"
                     bind:value={name}
                     placeholder="Enter name"
                     required
                     class="w-full bg-white border-2 border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none transition-all"
                  />
               </div>

               <!-- Edit Form Actions -->
               <div class="flex gap-2 mt-2">
                  <button
                     type="button"
                     onclick={cancelEditing}
                     disabled={isSaving}
                     class="flex-1 bg-slate-200 text-slate-600 font-black py-2.5 rounded-xl border-b-[3px] border-slate-300 hover:bg-slate-300 active:translate-y-[2px] active:border-b-0 uppercase transition-all text-xs"
                  >
                     Cancel
                  </button>
                  <button
                     type="submit"
                     disabled={isSaving}
                     class="flex-1 bg-indigo-500 text-white font-black py-2.5 rounded-xl border-b-[3px] border-indigo-700 hover:bg-indigo-600 active:translate-y-[2px] active:border-b-0 uppercase transition-all text-xs flex items-center justify-center gap-2"
                  >
                     {#if isSaving}
                        <span
                           class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"
                        ></span>
                     {/if}
                     Save
                  </button>
               </div>
            </form>
         {/if}
      </div>

      <!-- Main Action Buttons -->
      {#if !isEditing}
         <button
            class="w-full mt-4 bg-indigo-500 text-white font-black py-3 rounded-2xl border-b-[4px] border-indigo-700 hover:bg-indigo-600 active:translate-y-[4px] active:border-b-0 uppercase transition-all text-sm"
            onclick={startEditing}
         >
            Edit Name
         </button>

         <button
            class="w-full mt-3 bg-slate-200 text-slate-600 font-black py-3 rounded-2xl border-b-[4px] border-slate-300 hover:bg-slate-300 active:translate-y-[4px] active:border-b-0 uppercase transition-all text-sm"
            onclick={() => {
               onClose()
               onLogout()
            }}
         >
            Disconnect Session
         </button>
      {/if}
   </div>
</div>
