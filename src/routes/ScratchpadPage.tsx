import { PageHeader } from '../components/PageHeader'
import { ScratchpadPanel } from '../components/ScratchpadPanel'

/**
 * Scratchpad page - standalone view for direct navigation.
 * Content is provided by ScratchpadPanel component.
 */
export default function ScratchpadPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Scratchpad" />
      <div className="flex-1 overflow-y-auto">
        <ScratchpadPanel autoFocus />
      </div>
    </div>
  )
}
