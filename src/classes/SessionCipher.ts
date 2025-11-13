import { bootstrap, requireModule } from '../registry.js'
import { deepNormalizeBytes, toRaw32, toUint8 } from '../utils.js'
import { SessionRecord } from './SessionRecord.js'
import type { ISessionStore } from '../types.js'

export class SessionCipher {
    public store: ISessionStore
    public addr: any

    constructor(store: ISessionStore, protocolAddress: any) {
        this.store = store
        this.addr = protocolAddress
    }

    async encrypt(plain: any) {
        await bootstrap()
        const Cipher = await requireModule<any>('WASignalCipher')
        let rec = await this.store.loadSession(this.addr.toString())
        if (!rec) throw new Error('No session found')
        const normalizedState = deepNormalizeBytes(rec._state)
        const res = await Cipher.encryptMsg(normalizedState, plain)
        await this.store.storeSession(this.addr.toString(), new SessionRecord(res[0]))
        const out = res[1]
        return { type: out.type === 'pkmsg' ? 3 : 1, body: out.ciphertext }
    }

    async decryptWhisperMessage(ciphertext: any): Promise<Uint8Array> {
        await bootstrap()
        const Cipher = await requireModule<any>('WASignalCipher')
        let rec = await this.store.loadSession(this.addr.toString())
        if (!rec) throw new Error('No session found')
        let msgBuf = ciphertext instanceof Uint8Array ? ciphertext : new Uint8Array(ciphertext)
        const normalizedState = deepNormalizeBytes(rec._state)
        const desMsg = Cipher.deserializeMsg(msgBuf)
        if (!desMsg || !desMsg.success) {
            throw new Error('SignalMessage deserialize failed')
        }
        const parsed = desMsg.value
        const rk = parsed && (parsed.ratchetKey || parsed.ratchetPubKey || parsed.senderRatchetKey)
        if (!rk) {
            throw new Error('SignalMessage missing ratchetKey in header')
        }
        const res = await Cipher.decryptMsgFromSession(normalizedState, parsed)
        if (!res || !res.success) {
            const err = res && res.error ? res.error : 'unknown'
            throw new Error(`decryptMsgFromSession failed: ${err}`)
        }
        const [updatedSession, out] = res.value
        await this.store.storeSession(this.addr.toString(), new SessionRecord(updatedSession))
        return out
    }

    async decryptPreKeyWhisperMessage(ciphertext: any): Promise<Uint8Array> {
        await bootstrap()
        const Cipher = await requireModule<any>('WASignalCipher')
        const Keys = await requireModule<any>('WASignalKeys')
        const PBLocal = await requireModule<any>('WASignalLocalStorageProtocol.pb')
        const Signatures = await requireModule<any>('WASignalSignatures')
        const Other = await requireModule<any>('WASignalOther')

        const bytesAll = ciphertext instanceof Uint8Array ? ciphertext : new Uint8Array(ciphertext)
        const des = Cipher.deserializePkMsg(bytesAll)
        if (des && des.success) {
            const parsed = des.value
            const regId = await this.store.getOurRegistrationId()
            const ourId = await this.store.getOurIdentity()
            const local = {
                regId,
                staticKeyPair: {
                    privateKey: new Uint8Array((ourId as any).privKey),
                    publicKey: new Uint8Array((ourId as any).pubKey.subarray(1))
                }
            }
            const existingRec = await this.store.loadSession(this.addr.toString())
            const existing = existingRec ? deepNormalizeBytes(existingRec._state) : null

            const spk = await this.store.loadSignedPreKey(parsed.localSignedPreKeyId)
            if (!spk)
                throw new Error(
                    `SignedPreKey not found in store for id ${parsed.localSignedPreKeyId}`
                )
            const spkKP = {
                privateKey: toUint8((spk as any).privKey || (spk as any).privateKey),
                publicKey: toRaw32((spk as any).pubKey || (spk as any).publicKey)
            }
            const spkSig = (spk as any).signature
                ? (spk as any).signature instanceof Uint8Array
                    ? (spk as any).signature
                    : (spk as any).signature.data
                      ? new Uint8Array((spk as any).signature.data)
                      : new Uint8Array((spk as any).signature)
                : new Uint8Array(64)
            const spkTs =
                typeof (spk as any).timestamp === 'number'
                    ? (spk as any).timestamp
                    : typeof (spk as any).ts === 'number'
                      ? (spk as any).ts
                      : Date.now()
            const signedPreKeyRecord = Signatures.serializeSignedPreKeyForPrivateStorage({
                id: parsed.localSignedPreKeyId,
                ts: spkTs,
                keyPair: spkKP,
                signature: spkSig
            })

            let oneTimePreKeyRecord: Uint8Array | undefined = undefined
            if (parsed.localOneTimeKeyId != null) {
                const okp = await this.store.loadPreKey(parsed.localOneTimeKeyId)
                if (!okp)
                    throw new Error(`PreKey not found in store for id ${parsed.localOneTimeKeyId}`)
                const okSrc = (okp as any).keyPair || okp
                const okPriv = (okSrc as any).privKey || (okSrc as any).privateKey
                const okPub = (okSrc as any).pubKey || (okSrc as any).publicKey
                if (!okPriv || !okPub) {
                    throw new Error('PreKey record missing keys from store')
                }
                if (okPriv.length !== 32) {
                    throw new Error(`PreKey privateKey length ${okPriv.length} != 32`)
                }
                if (okPub.length !== 32) {
                    throw new Error(`PreKey publicKey length ${okPub.length} != 32`)
                }

                oneTimePreKeyRecord = Other.encodeSignalProto(PBLocal.PreKeyRecordStructureSpec, {
                    id: Keys.castToPreKeyId(parsed.localOneTimeKeyId),
                    publicKey: Keys.serializePubKey({ publicKey: okPub }),
                    privateKey: okPriv
                })

                const round = Keys.deserializePreKey(oneTimePreKeyRecord)
                if (!round) {
                    throw new Error('Local one-time PreKey record failed to deserialize')
                }
                if (round.id !== parsed.localOneTimeKeyId) {
                    throw new Error(
                        `Local one-time PreKey id mismatch: encoded ${round.id} vs expected ${parsed.localOneTimeKeyId}`
                    )
                }
            }

            const keyBundle = {
                localSignedPreKey: signedPreKeyRecord,
                localOneTimeKey: oneTimePreKeyRecord
            }
            const rr = await Cipher.decryptPkMsgWithNewSession(local, existing, parsed, keyBundle)
            if (!rr || !rr.success) {
                const errCode = rr && rr.error ? rr.error : 'unknown'
                throw new Error(`decryptPkMsgWithNewSession failed: ${errCode}`)
            }
            const { updatedSession, plaintext } = rr.value
            await this.store.storeSession(this.addr.toString(), new SessionRecord(updatedSession))
            if (parsed.localOneTimeKeyId != null && typeof this.store.removePreKey === 'function') {
                try {
                    await this.store.removePreKey(parsed.localOneTimeKeyId)
                } catch {}
            }
            const out = plaintext as Uint8Array
            return out
        }
        throw new Error('Invalid PreKeySignalMessage')
    }
}
