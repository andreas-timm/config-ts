import { type EventType, type State } from 'js-yaml'

export class SourceMapMissed {
    indent = 0
    pathIndex = 0
    currentPath: { line: number; lineEnd: number; key: string }[] = []
    dataPaths: { line: number; lineEnd: number; key: string }[][] = []
    lastKey!: string

    constructor() {}

    handleState(eventType: EventType, state: State) {
        if (eventType === 'close' && state.kind === 'scalar') {
            if (state.lineIndent > this.indent) {
                this.indent = state.lineIndent
                this.pathIndex++
            } else if (state.lineIndent < this.indent) {
                this.indent = state.lineIndent
                this.pathIndex--
            } else {
            }

            this.lastKey = state.result

            if (this.pathIndex > this.currentPath.length - 1) {
                this.currentPath.push({ line: state.line, lineEnd: state.line, key: state.result })
            } else {
                this.currentPath[this.pathIndex] = {
                    line: state.line,
                    lineEnd: state.line,
                    key: state.result,
                }

                if (this.pathIndex < this.currentPath.length - 1) {
                    this.currentPath.pop()
                }
            }

            this.dataPaths.push([...this.currentPath])
        }
    }

    listen() {
        return this.handleState.bind(this)
    }

    lookup(path: string[]) {
        this.dataPaths.forEach((path) =>
            path.slice(0, -1).forEach((s) => (s.lineEnd = path[path.length - 1].line)),
        )

        let last: { index: 0; lineEnd?: number } = { index: 0 }
        for (const p of this.dataPaths) {
            if (p.length > last.index && path[last.index] === p[last.index].key) {
                last.lineEnd = p[last.index].lineEnd
                last.index++
            }
        }

        last.index--

        return last
    }
}
