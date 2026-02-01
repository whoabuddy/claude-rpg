# PLAN: Phase 10 - Scratchpad Enhancements

<plan>
  <goal>
    Enhance the Scratchpad page with quick capture capabilities, voice recording integration, and mobile-optimized input for rapid thought capture.
  </goal>

  <context>
    Issue #156: Scratchpad for notes - quick thought capture, voice recording

    Current state:
    - ScratchpadPage exists with basic note functionality
    - Notes API exists (/api/notes CRUD)
    - VoiceButton component exists for transcription
    - TranscribePage shows dedicated transcription UI

    Enhancements needed:
    - Quick capture without full form (tap, type, done)
    - Voice recording inline (not separate page)
    - Tag suggestions based on context
    - Mobile keyboard optimization

    Files to read:
    - src/routes/ScratchpadPage.tsx
    - src/components/VoiceButton.tsx
    - server-v2/notes/service.ts
  </context>

  <task id="1">
    <name>Add quick capture input</name>
    <files>src/routes/ScratchpadPage.tsx</files>
    <action>
      1. Add quick capture component at top of page:
         ```tsx
         function QuickCapture({ onCapture }: { onCapture: (text: string) => void }) {
           const [text, setText] = useState('')
           const inputRef = useRef<HTMLTextAreaElement>(null)

           const handleSubmit = () => {
             if (text.trim()) {
               onCapture(text.trim())
               setText('')
               inputRef.current?.focus()
             }
           }

           const handleKeyDown = (e: React.KeyboardEvent) => {
             // Cmd/Ctrl+Enter to submit
             if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
               e.preventDefault()
               handleSubmit()
             }
           }

           return (
             <div className="bg-rpg-card border border-rpg-border rounded-lg p-3">
               <textarea
                 ref={inputRef}
                 value={text}
                 onChange={e => setText(e.target.value)}
                 onKeyDown={handleKeyDown}
                 placeholder="Quick thought... (Cmd+Enter to save)"
                 className="w-full bg-transparent text-rpg-text placeholder-rpg-text-dim
                          resize-none outline-none text-sm"
                 rows={2}
               />
               <div className="flex items-center justify-between mt-2">
                 <span className="text-xs text-rpg-text-dim">
                   {text.length > 0 && `${text.length} chars`}
                 </span>
                 <div className="flex gap-2">
                   <VoiceButton onTranscript={t => setText(prev => prev + t)} />
                   <button
                     onClick={handleSubmit}
                     disabled={!text.trim()}
                     className="px-3 py-1.5 text-sm bg-rpg-accent text-rpg-bg rounded-lg
                              disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     Save
                   </button>
                 </div>
               </div>
             </div>
           )
         }
         ```

      2. Integrate into ScratchpadPage:
         ```tsx
         export default function ScratchpadPage() {
           const { notes, createNote, ... } = useNotes()

           const handleQuickCapture = async (text: string) => {
             await createNote({ content: text, status: 'inbox' })
             // Show success toast
           }

           return (
             <div className="flex flex-col h-full">
               <PageHeader title="Scratchpad" />
               <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 <QuickCapture onCapture={handleQuickCapture} />
                 {/* Notes list */}
               </div>
             </div>
           )
         }
         ```
    </action>
    <verify>
      1. Navigate to Scratchpad
      2. Type in quick capture area
      3. Press Cmd+Enter - note saves and input clears
      4. Verify note appears in list
      5. Test Save button as alternative
    </verify>
    <done>Quick capture input with keyboard shortcut</done>
  </task>

  <task id="2">
    <name>Integrate voice recording</name>
    <files>src/routes/ScratchpadPage.tsx, src/components/VoiceButton.tsx</files>
    <action>
      1. Enhance VoiceButton for inline use:
         ```tsx
         interface VoiceButtonProps {
           onTranscript: (text: string) => void
           size?: 'sm' | 'md'
         }

         export function VoiceButton({ onTranscript, size = 'md' }: VoiceButtonProps) {
           const [recording, setRecording] = useState(false)
           const [transcribing, setTranscribing] = useState(false)

           const handleClick = async () => {
             if (recording) {
               // Stop and transcribe
               setRecording(false)
               setTranscribing(true)
               // ... transcription logic
               setTranscribing(false)
             } else {
               // Start recording
               setRecording(true)
               // ... recording logic
             }
           }

           const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'

           return (
             <button
               onClick={handleClick}
               disabled={transcribing}
               className={`${sizeClasses} rounded-full flex items-center justify-center
                         transition-colors ${
                           recording
                             ? 'bg-rpg-error text-white animate-pulse'
                             : transcribing
                             ? 'bg-rpg-working text-white'
                             : 'bg-rpg-border text-rpg-text-muted hover:bg-rpg-card'
                         }`}
               title={recording ? 'Stop recording' : 'Start voice note'}
             >
               {transcribing ? (
                 <LoadingSpinner className="w-4 h-4" />
               ) : (
                 <MicrophoneIcon className={`${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'}`} />
               )}
             </button>
           )
         }
         ```

      2. Add visual feedback during recording:
         - Pulsing red border on quick capture area
         - Waveform or level indicator if possible

      3. Handle transcription result:
         ```tsx
         const handleTranscript = (transcript: string) => {
           setText(prev => prev ? `${prev} ${transcript}` : transcript)
         }
         ```
    </action>
    <verify>
      1. Click microphone button
      2. Speak a phrase
      3. Click again to stop
      4. Verify transcript appears in input
      5. Verify can edit before saving
      6. Test recording indicator animation
    </verify>
    <done>Voice recording integrated into quick capture</done>
  </task>

  <task id="3">
    <name>Add tag suggestions and mobile optimization</name>
    <files>src/routes/ScratchpadPage.tsx, src/components/TagSuggestions.tsx (new)</files>
    <action>
      1. Create TagSuggestions component:
         ```tsx
         interface TagSuggestionsProps {
           existingTags: string[]
           onSelect: (tag: string) => void
         }

         export function TagSuggestions({ existingTags, onSelect }: TagSuggestionsProps) {
           // Combine recent tags with common suggestions
           const suggestions = useMemo(() => {
             const common = ['idea', 'todo', 'bug', 'question', 'followup']
             const recent = existingTags.slice(0, 5)
             return [...new Set([...recent, ...common])].slice(0, 8)
           }, [existingTags])

           return (
             <div className="flex flex-wrap gap-1.5">
               {suggestions.map(tag => (
                 <button
                   key={tag}
                   onClick={() => onSelect(tag)}
                   className="px-2 py-1 text-xs bg-rpg-border/50 text-rpg-text-muted
                            rounded-full hover:bg-rpg-accent/20 hover:text-rpg-accent
                            transition-colors"
                 >
                   #{tag}
                 </button>
               ))}
             </div>
           )
         }
         ```

      2. Integrate tag suggestions:
         ```tsx
         <QuickCapture onCapture={handleQuickCapture}>
           <TagSuggestions
             existingTags={uniqueTags}
             onSelect={tag => setText(prev => `${prev} #${tag}`)}
           />
         </QuickCapture>
         ```

      3. Mobile keyboard optimization:
         ```tsx
         // Add inputMode for better mobile keyboard
         <textarea
           inputMode="text"
           enterKeyHint="send"
           autoComplete="off"
           autoCorrect="on"
           spellCheck={true}
           // ... other props
         />
         ```

      4. Add autofocus on page load for quick capture:
         ```tsx
         useEffect(() => {
           // Autofocus on desktop, not on mobile (keyboard would pop)
           if (window.innerWidth >= 640) {
             inputRef.current?.focus()
           }
         }, [])
         ```

      5. Style for mobile:
         - Larger tap targets (min 44px)
         - Full-width input
         - Sticky quick capture at top
         - Notes list scrollable below
    </action>
    <verify>
      1. Verify tag suggestions appear below input
      2. Click a tag - verify it's added to input
      3. Test on mobile viewport:
         - Input is full width
         - Keyboard shows appropriate type
         - Tags are tappable
      4. Verify no autofocus keyboard popup on mobile
    </verify>
    <done>Tag suggestions and mobile-optimized input</done>
  </task>
</plan>

## Files Summary

**Create:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/TagSuggestions.tsx`

**Modify:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/routes/ScratchpadPage.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/VoiceButton.tsx`

## Commits

1. `feat(scratchpad): add quick capture input with keyboard shortcut`
2. `feat(scratchpad): integrate voice recording for quick notes`
3. `feat(scratchpad): add tag suggestions and mobile optimization`
