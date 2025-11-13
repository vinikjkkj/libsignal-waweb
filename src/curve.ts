import { getSignalKeys, getSignalSignatures } from './registry.js'
import { toRaw32, toUint8 } from './utils.js'
import { generateSignedPreKey as generateSignedPreKeyHelper } from './helpers.js'

export const KEY_BUNDLE_TYPE = new Uint8Array([5])

export function generateSignalPubKey(pubKey: Uint8Array | Buffer): Uint8Array {
    const raw = toRaw32(pubKey)
    const out = new Uint8Array(33)
    out[0] = KEY_BUNDLE_TYPE[0]
    out.set(raw, 1)
    return out
}

function normalizeKeyPair(kp: any): { privateKey: Uint8Array; publicKey: Uint8Array } {
    const priv = kp?.private != null ? kp.private : kp?.privateKey
    const pub = kp?.public != null ? kp.public : kp?.publicKey
    return { privateKey: toRaw32(priv), publicKey: toRaw32(pub) }
}

export async function generateKeyPair(): Promise<{ private: Uint8Array; public: Uint8Array }> {
    const Keys: any = await getSignalKeys()
    const kp = Keys.makeKeyPair()
    return { private: toRaw32(kp.privateKey), public: toRaw32(kp.publicKey) }
}

export async function sharedKey(
    privateKey: Uint8Array,
    publicKey: Uint8Array
): Promise<Uint8Array> {
    const Keys: any = await getSignalKeys()
    const priv = toRaw32(privateKey)
    const pubSer = generateSignalPubKey(publicKey)
    const shared: ArrayBuffer = Keys.ecdh(priv, pubSer)
    return new Uint8Array(shared)
}

export async function sign(privateKey: Uint8Array, buf: Uint8Array): Promise<Uint8Array> {
    const Signatures: any = await getSignalSignatures()
    const identity = { privateKey: toRaw32(privateKey) }
    const serialized = generateSignalPubKey(buf)
    const candidates = ['signMsg', 'makeSignature', 'signSenderKeyMessage']
    for (const name of candidates) {
        if (typeof Signatures[name] === 'function') {
            const sig = await Signatures[name](identity, serialized)
            if (sig) return toUint8(sig)
        }
    }
    throw new Error('No suitable signature function found in WASignalSignatures')
}

export async function verify(
    pubKey: Uint8Array,
    message: Uint8Array,
    signature: Uint8Array
): Promise<boolean> {
    try {
        const Signatures: any = await getSignalSignatures()
        const serialized = generateSignalPubKey(pubKey)
        const msgU8 = toUint8(message)
        const sigU8 = toUint8(signature)
        const candidates = ['verifyMsgSignalVariant']
        for (const name of candidates) {
            if (typeof Signatures[name] === 'function') {
                const ok = await Signatures[name](serialized, msgU8, sigU8)
                if (typeof ok === 'boolean') return ok
            }
        }
    } catch {}
    return false
}

export async function signedKeyPair(identityKeyPair: any, keyId: number) {
    const idKp = normalizeKeyPair(identityKeyPair)
    const spk = await generateSignedPreKeyHelper(idKp as any, keyId)
    return { keyPair: spk.keyPair, signature: toUint8(spk.signature), keyId }
}
