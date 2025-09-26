function base64ToUint8Array(b64: string): Uint8Array {
    const sanitized = b64
        .replace(/[\r\n\s]/g, '')
        .replace(/-/g, '+')
        .replace(/_/g, '/')
    if (sanitized.length % 4 === 1) throw new Error('Invalid base64 string length')
    const padded =
        sanitized.length % 4 === 0 ? sanitized : sanitized + '='.repeat(4 - (sanitized.length % 4))
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
}

function hexToUint8Array(hex: string): Uint8Array {
    const sanitized = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex
    if (sanitized.length % 2 !== 0) throw new Error('Invalid hex string length')
    const upper = sanitized.toLowerCase()
    const out = new Uint8Array(upper.length / 2)
    for (let i = 0; i < out.length; i++) {
        const byte = upper.slice(i * 2, i * 2 + 2)
        out[i] = parseInt(byte, 16)
    }
    return out
}

export function toUint8(x: any): any {
    if (x && typeof x === 'object' && x.type === 'Buffer' && Array.isArray((x as any).data))
        return new Uint8Array((x as any).data)
    if (x instanceof Uint8Array) return x
    if (x && typeof x === 'object') {
        const keys = Object.keys(x as any)
        if (keys.length && keys.every((k) => /^\d+$/.test(k))) {
            const ordered = keys.sort((a, b) => (a as any) - (b as any)).map((k) => (x as any)[k])
            if (ordered.every((v: any) => typeof v === 'number')) return new Uint8Array(ordered)
        }
    }
    if (Array.isArray(x) && x.every((v) => typeof v === 'number'))
        return new Uint8Array(x as number[])
    if (typeof x === 'string') {
        const trimmed = x.trim()
        if (!trimmed.length) return new Uint8Array()
        try {
            return hexToUint8Array(trimmed)
        } catch (hexError) {
            try {
                return base64ToUint8Array(trimmed)
            } catch (base64Error) {}
        }
    }
    return x
}

export function deepNormalizeBytes(obj: any, seen: WeakSet<any> = new WeakSet()): any {
    if (obj == null) return obj
    const u8 = toUint8(obj)
    if (u8 instanceof Uint8Array) return u8
    if (typeof obj !== 'object') return obj
    if (seen.has(obj)) return obj
    seen.add(obj)
    if (Array.isArray(obj)) {
        return obj.map((v) => deepNormalizeBytes(v, seen))
    }
    const out: any = Array.isArray(obj) ? [] : { ...(obj as any) }
    for (const k of Object.keys(out)) {
        out[k] = deepNormalizeBytes(out[k], seen)
    }
    return out
}

export function toRaw32(v: any) {
    const x = toUint8(v)
    return x.length === 33 && x[0] === 5
        ? x.subarray(1)
        : x.length === 32
          ? x
          : new Uint8Array(x.buffer, x.byteOffset, 32)
}
