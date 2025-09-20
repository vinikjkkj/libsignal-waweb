export function toUint8(x: any): any {
    if (typeof Buffer !== 'undefined' && (Buffer as any).isBuffer && Buffer.isBuffer(x))
        return new Uint8Array(x)
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
        try {
            return new Uint8Array(Buffer.from(x, 'base64'))
        } catch {}
        try {
            return new Uint8Array(Buffer.from(x, 'hex'))
        } catch {}
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
