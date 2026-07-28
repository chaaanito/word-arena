<script>
   let { gameState, socketId, socket } = $props()

   // --- Derived State ---
   let isMyChoice = $derived(gameState?.choosingPlayerId === socketId)
   let isMyTurn = $derived(
      gameState?.players?.[gameState.currentTurnIndex]?.id === socketId
   )

   // --- Audio Arrays ---
   let myPenaltySounds = []
   let otherPenaltySounds = []
   let turnSounds = []
   let chatSounds = []
   let correctSounds = []
   let wrongSounds = []

   // --- Skill Audio Arrays ---
   let reverseSounds = []
   let skipSounds = []
   let rerollSounds = []
   let bombSounds = []
   let healSounds = []
   let nukeSounds = []
   let scrambleSounds = []

   // --- State Trackers for Transitions ---
   let isMounted = false
   let previousStatus
   let previousTurn
   let previousWordCount

   // Initialize Audio objects on mount
   $effect(() => {
      // Basic Sounds
      const myPenaltyPaths = [
         '/sounds/penalty-1.mp3',
         '/sounds/penalty-2.mp3',
         '/sounds/penalty-3.mp3',
         '/sounds/penalty-4.mp3',
         '/sounds/penalty-5.mp3',
         '/sounds/penalty-6.mp3',
         '/sounds/penalty-7.mp3',
         '/sounds/penalty-8.mp3',
      ]
      const otherPenaltyPaths = [
         '/sounds/penalty-1.mp3',
         '/sounds/penalty-2.mp3',
         '/sounds/penalty-3.mp3',
         '/sounds/penalty-4.mp3',
         '/sounds/penalty-5.mp3',
         '/sounds/penalty-6.mp3',
         '/sounds/penalty-7.mp3',
         '/sounds/penalty-8.mp3',
      ]
      const turnPaths = ['/sounds/turn-1.mp3']
      const chatPaths = ['/sounds/chat-pop.mp3']
      const correctPaths = [
         '/sounds/correct-1.mp3',
         '/sounds/correct-2.mp3',
         '/sounds/correct-3.mp3',
      ]
      const wrongPaths = [
         '/sounds/penalty-1.mp3',
         '/sounds/penalty-2.mp3',
         '/sounds/penalty-3.mp3',
         '/sounds/penalty-5.mp3',
         '/sounds/penalty-7.mp3',
         '/sounds/penalty-8.mp3',
      ]

      // Skill Sounds
      const reversePaths = ['/sounds/skill-reverse.mp3']
      const skipPaths = ['/sounds/penalty-3.mp3']
      const rerollPaths = ['/sounds/skill-reroll.mp3']
      const bombPaths = ['/sounds/penalty-9.mp3']
      const healPaths = ['/sounds/skill-heal.mp3']
      const nukePaths = ['/sounds/skill-nuke.mp3']
      const scramblePaths = ['/sounds/skill-scramble.mp3']

      // Helper to map paths to Audio objects quickly
      const createAudioArray = (paths, vol) =>
         paths.map((p) => {
            const a = new Audio(p)
            a.volume = vol
            return a
         })

      myPenaltySounds = createAudioArray(myPenaltyPaths, 0.7)
      otherPenaltySounds = createAudioArray(otherPenaltyPaths, 0.5)
      turnSounds = createAudioArray(turnPaths, 0.5)
      chatSounds = createAudioArray(chatPaths, 0.3)
      correctSounds = createAudioArray(correctPaths, 0.6)
      wrongSounds = createAudioArray(wrongPaths, 0.6)

      reverseSounds = createAudioArray(reversePaths, 0.6)
      skipSounds = createAudioArray(skipPaths, 0.6)
      rerollSounds = createAudioArray(rerollPaths, 0.6)
      bombSounds = createAudioArray(bombPaths, 0.8)
      healSounds = createAudioArray(healPaths, 0.6)
      nukeSounds = createAudioArray(nukePaths, 0.8)
      scrambleSounds = createAudioArray(scramblePaths, 0.7)
   })

   // Helper function to play a random sound
   function playRandomSound(audioArray) {
      if (!audioArray || audioArray.length === 0) return
      const randomIndex = Math.floor(Math.random() * audioArray.length)
      const sound = audioArray[randomIndex]
      sound.currentTime = 0
      sound.play().catch((err) => console.warn('Audio blocked:', err))
   }

   // Watch for Game State changes
   $effect(() => {
      if (!gameState) return
      if (!isMounted) {
         previousStatus = gameState.status
         previousTurn = isMyTurn
         previousWordCount = gameState.usedWords ? gameState.usedWords.length : 0
         isMounted = true
         return
      }

      // EVENT: A player answered correctly!
      if (gameState.usedWords && gameState.usedWords.length > previousWordCount) {
         playRandomSound(correctSounds)
      }

      // EVENT: Player gets a penalty
      if (
         gameState.status === 'choosing_prefix' &&
         previousStatus !== 'choosing_prefix'
      ) {
         if (isMyChoice) playRandomSound(myPenaltySounds)
         else playRandomSound(otherPenaltySounds)
      }

      // EVENT: It becomes your turn
      if (gameState.status === 'playing' && isMyTurn && !previousTurn) {
         playRandomSound(turnSounds)
      }

      previousStatus = gameState.status
      previousTurn = isMyTurn
      previousWordCount = gameState.usedWords ? gameState.usedWords.length : 0
   })

   // Watch for Direct Socket Events
   $effect(() => {
      if (socket) {
         const onMessage = (data) => {
            if (data.playerId !== socketId) playRandomSound(chatSounds)
         }
         const onError = (data) => {
            if (gameState && gameState.status === 'playing') playRandomSound(wrongSounds)
         }
         const onInfoMessage = (data) => {
            if (!data || !data.message) return
            const msg = data.message
            if (msg.includes(' ')) playRandomSound(reverseSounds)
            else if (msg.includes(' ')) playRandomSound(skipSounds)
            else if (msg.includes(' ')) playRandomSound(rerollSounds)
            else if (msg.includes(' ')) playRandomSound(bombSounds)
            else if (msg.includes(' ')) playRandomSound(healSounds)
            else if (msg.includes(' ')) playRandomSound(nukeSounds)
            else if (msg.includes(' ')) playRandomSound(scrambleSounds)
         }

         socket.on('vocab:chat', onMessage)
         socket.on('vocab:error', onError)
         socket.on('vocab:info_message', onInfoMessage)
         return () => {
            socket.off('vocab:chat', onMessage)
            socket.off('vocab:error', onError)
            socket.off('vocab:info_message', onInfoMessage)
         }
      }
   })
</script>
