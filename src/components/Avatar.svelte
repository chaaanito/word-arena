<script>
   import { domain } from '../scripts/Pocketbase.svelte'
   import { SHOP_BORDERS } from './Border'

   let { player, className = 'w-10 h-10' } = $props()

   // Look up the equipped border object from our JS file
   let activeBorder = $derived(
      player?.equipment?.border
         ? SHOP_BORDERS.find((b) => b.id === player.equipment.border)
         : null
   )

   // Fallback for CSS-only borders if needed
   let borderClass = $derived(
      activeBorder && !activeBorder.isImage ? activeBorder.cssClass : ''
   )

   // --- Particle system -------------------------------------------------
   // Builds an array of particle descriptors from the border config.
   function buildParticles(border) {
      const count = border.particleCount ?? 6
      const duration = border.particleDuration ?? 4
      const size = border.particleSize ?? 4
      const style = border.particleStyle ?? 'orbit'
      const rings = border.particleRings ?? 2

      return Array.from({ length: count }, (_, i) => ({
         key: i,
         style,
         size,
         duration,
         delay: -(i / count) * duration,
         color: border.particleColors
            ? border.particleColors[i % border.particleColors.length]
            : (border.particleColor ?? '#ffffff'),
         ring: i % rings,
      }))
   }

   function ringInset(ring) {
      return -4 - ring * 10
   }

   let particles = $derived(
      activeBorder?.hasParticles ? buildParticles(activeBorder) : []
   )
</script>

<div class="relative flex items-center justify-center shrink-0 {className}">
   <div
      class="w-full h-full rounded-full border-2 border-slate-200 bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden relative shadow-sm"
   >
      {#if player.avatar}
         <img
            src={`${domain}/api/files/users/${player.dbId}/${player.avatar}?thumb=300x0`}
            alt={player.name}
            class="w-full h-full object-cover"
         />
      {:else}
         <span class="font-black text-slate-400 select-none uppercase">
            {player.name ? player.name.charAt(0) : '?'}
         </span>
      {/if}
   </div>

   <div
      class="absolute inset-0 rounded-full pointer-events-none z-10 {borderClass}"
   ></div>

   {#if activeBorder && activeBorder.isImage}
      <div
         class="absolute rounded-full pointer-events-none z-20"
         style="
            inset: {activeBorder.inset}; 
            background-image: url('{activeBorder.assetPath}');
            background-size: cover;
            background-position: center;
            mix-blend-mode: {activeBorder.blendMode};
            animation: {activeBorder.animation};
            opacity: 0.9;
         "
      ></div>
   {/if}

   <!-- Particle layer: sits above everything else -->
   {#if particles.length}
      <div class="absolute inset-0 z-30 pointer-events-none">
         {#each particles as p (p.key)}
            {#if p.style === 'scatter'}
               <div class="absolute" style="inset: {ringInset(p.ring)}px;">
                  <div
                     class="orbit-particle"
                     style="--duration: {p.duration}s; --delay: {p.delay}s;"
                  >
                     <span
                        class="dot twinkle"
                        style="--size: {p.size}px; --color: {p.color};"
                     ></span>
                  </div>
               </div>
            {:else if p.style === 'comet'}
               <div
                  class="orbit-particle"
                  style="--duration: {p.duration}s; --delay: {p.delay}s;"
               >
                  <span class="dot comet" style="--size: {p.size}px; --color: {p.color};"
                  ></span>
               </div>
            {:else}
               <div
                  class="orbit-particle"
                  style="--duration: {p.duration}s; --delay: {p.delay}s;"
               >
                  <span
                     class="dot {activeBorder.twinkle ? 'twinkle' : ''}"
                     style="--size: {p.size}px; --color: {p.color};"
                  ></span>
               </div>
            {/if}
         {/each}
      </div>
   {/if}
</div>

<style>
   :global(.fire-border)::before {
      content: '';
      position: absolute;
      inset: -6px;
      border-radius: 50%;
      background: conic-gradient(from 0deg, #ff4e00, #ec9f05, #ff4e00, #ec9f05, #ff4e00);
      animation: -global-spin-border 1.5s linear infinite;
      filter: blur(4px);
   }
   :global(.neon-border)::before {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      box-shadow:
         0 0 10px #0ff,
         0 0 20px #0ff,
         inset 0 0 10px #0ff;
      border: 2px solid #0ff;
      animation: -global-pulse-neon 2s ease-in-out infinite alternate;
   }
   :global(.shimmer-border)::before {
      content: '';
      position: absolute;
      inset: -5px;
      border-radius: 50%;
      background: linear-gradient(90deg, #8a2be2, #4b0082, #ff1493, #8a2be2);
      background-size: 300% 300%;
      animation: -global-shimmer-bg 3s ease infinite;
      filter: blur(2px);
   }
   .orbit-particle {
      position: absolute;
      inset: 0;
      animation: spin-particle var(--duration, 4s) linear infinite;
      animation-delay: var(--delay, 0s);
      pointer-events: none;
   }
   .orbit-particle .dot {
      position: absolute;
      top: 0;
      left: 50%;
      width: var(--size, 4px);
      height: var(--size, 4px);
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: radial-gradient(circle, var(--color, #fff) 0%, transparent 70%);
      box-shadow: 0 0 6px var(--color, #fff);
   }
   .orbit-particle .dot.twinkle {
      animation: twinkle-particle 1.2s ease-in-out infinite alternate;
   }
   .orbit-particle .dot.comet {
      width: calc(var(--size, 4px) * 4);
      height: calc(var(--size, 4px) * 0.6);
      border-radius: 999px;
      background: linear-gradient(90deg, transparent, var(--color, #fff));
      box-shadow: 0 0 6px var(--color, #fff);
   }
   @keyframes spin-particle {
      to {
         transform: rotate(360deg);
      }
   }
   @keyframes twinkle-particle {
      0% {
         opacity: 0.25;
         transform: translate(-50%, -50%) scale(0.6);
      }
      100% {
         opacity: 1;
         transform: translate(-50%, -50%) scale(1.25);
      }
   }
   @keyframes -global-spin-border {
      100% {
         transform: rotate(360deg);
      }
   }
   @keyframes -global-pulse-neon {
      0% {
         opacity: 0.8;
         box-shadow:
            0 0 5px #0ff,
            0 0 15px #0ff;
      }
      100% {
         opacity: 1;
         box-shadow:
            0 0 15px #0ff,
            0 0 25px #0ff;
      }
   }
   @keyframes -global-shimmer-bg {
      0% {
         background-position: 0% 50%;
      }
      50% {
         background-position: 100% 50%;
      }
      100% {
         background-position: 0% 50%;
      }
   }
   @keyframes -global-spin-particles {
      0% {
         transform: rotate(0deg) scale(1);
      }
      50% {
         transform: rotate(180deg) scale(1.1);
      }
      100% {
         transform: rotate(360deg) scale(1);
      }
   }
</style>
