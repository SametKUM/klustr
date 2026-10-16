import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { tektonStateClass, tektonStateLabel } from './tektonFormat'
import { layoutTaskGraph, NODE_HEIGHT, NODE_WIDTH, type GraphTask } from './tektonGraph'

type Props = {
  tasks: GraphTask[]
  // onSelect gets the pipeline task name of the clicked node.
  onSelect?: (name: string) => void
}

// TektonTaskGraph draws a Pipeline's tasks left to right in dependency
// order, colored by state on a PipelineRun. Clicking a task opens what it
// ran (a TaskRun) or what it refers to (a Task).
export function TektonTaskGraph({ tasks, onSelect }: Props) {
  const layout = useMemo(() => layoutTaskGraph(tasks), [tasks])
  if (layout.nodes.length === 0) return null
  const pad = 8
  return (
    <div className="overflow-x-auto rounded border border-border bg-muted/20 p-3">
      <div className="relative" style={{ width: layout.width + pad * 2, height: layout.height + pad * 2 }}>
        <svg
          className="pointer-events-none absolute inset-0 text-border"
          width={layout.width + pad * 2}
          height={layout.height + pad * 2}
          aria-hidden
        >
          {layout.finallyX >= 0 && (
            <line
              x1={layout.finallyX + pad - 28}
              x2={layout.finallyX + pad - 28}
              y1={0}
              y2={layout.height + pad * 2}
              stroke="currentColor"
              strokeDasharray="4 4"
            />
          )}
          {layout.edges.map((e) => {
            const x1 = e.x1 + pad
            const x2 = e.x2 + pad
            const y1 = e.y1 + pad
            const y2 = e.y2 + pad
            const mid = (x1 + x2) / 2
            return (
              <path
                key={`${e.from}->${e.to}`}
                d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              />
            )
          })}
        </svg>
        {layout.nodes.map((n) => {
          const content = (
            <>
              <span className="truncate font-mono text-xs">{n.label}</span>
              <span className="truncate text-[10px] text-muted-foreground">
                {n.finally ? 'finally' : ''}
                {n.state ? `${n.finally ? ' · ' : ''}${tektonStateLabel(n.state)}` : ''}
                {n.count && n.count > 1 ? ` ×${n.count}` : ''}
              </span>
            </>
          )
          const className = cn(
            'absolute flex flex-col justify-center rounded border border-border bg-background px-2 text-left',
            n.state && tektonStateClass(n.state),
          )
          const style = { left: n.x + pad, top: n.y + pad, width: NODE_WIDTH, height: NODE_HEIGHT }
          return onSelect ? (
            <button
              key={`${n.finally ? 'f' : 't'}-${n.name}`}
              type="button"
              title={n.name}
              className={cn(className, 'cursor-pointer hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
              style={style}
              onClick={() => onSelect(n.name)}
            >
              {content}
            </button>
          ) : (
            <div key={`${n.finally ? 'f' : 't'}-${n.name}`} title={n.name} className={className} style={style}>
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
