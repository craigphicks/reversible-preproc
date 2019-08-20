`use strict`

class PrependableError extends Error {
    constructor(m, e = null) {
        let prev_stack = null
        let msg = m
        if (e instanceof Error) {
            msg += ", " + e.message
            prev_stack = e.stack
        } else {
            if (e && JSON.stringify(e) !== undefined) {
                msg += ", " + JSON.stringify(e)
            }
        }
        super(msg)
        if (prev_stack)
            this.stack += '\n' + prev_stack
        this.name = this.constructor.name
    }
}

export default PrependableError