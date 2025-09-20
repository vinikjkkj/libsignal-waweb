import { bootstrap, requireModule } from '../registry'
import { SenderKeyRecord } from './SenderKeyRecord'
import { SenderKeyDistributionMessage } from './SenderKeyDistributionMessage'
import type { ISenderKeyStore } from '../types'
import { toUint8 } from '../utils'

export class GroupSessionBuilder {
    public store: ISenderKeyStore
    constructor(store: ISenderKeyStore) {
        this.store = store
    }

    private async _normalizeInternal(s: any) {
        const GroupSession = await requireModule<any>('WASignalGroupSession')
        const arr = s && Array.isArray(s.senderKeyStates) ? s.senderKeyStates : []
        const out = arr.map((st: any) => {
            if (!st) return st
            if (st.senderSigningKey) {
                if (st.senderSigningKey.public) {
                    let pub = toUint8(st.senderSigningKey.public)
                    if (pub && pub.length === 32) {
                        const ser = new Uint8Array(33)
                        ser[0] = 0x05
                        ser.set(pub, 1)
                        pub = ser
                    }
                    st = { ...st, senderSigningKey: { ...st.senderSigningKey, public: pub } }
                }
                if (st.senderSigningKey.private) {
                    st = {
                        ...st,
                        senderSigningKey: {
                            ...st.senderSigningKey,
                            private: toUint8(st.senderSigningKey.private)
                        }
                    }
                }
            }
            if (st.senderChainKey && st.senderChainKey.seed) {
                st = {
                    ...st,
                    senderChainKey: { ...st.senderChainKey, seed: toUint8(st.senderChainKey.seed) }
                }
            }
            if (Array.isArray(st.senderMessageKeys)) {
                st = {
                    ...st,
                    senderMessageKeys: st.senderMessageKeys.map((mk: any) =>
                        mk && mk.seed ? { ...mk, seed: toUint8(mk.seed) } : mk
                    )
                }
            }
            if (st.senderKeyChainKey && st.senderSigningKeyPublic) return st
            const parsed = GroupSession.parseSessionFromRecord({ senderKeyStates: [st] })
            return parsed.senderKeyStates[0]
        })
        return { senderKeyStates: out }
    }

    async create(senderKeyName: any) {
        await bootstrap()
        const GroupCipher = await requireModule<any>('WASignalGroupCipher')
        const GroupSession = await requireModule<any>('WASignalGroupSession')
        const Keys = await requireModule<any>('WASignalKeys')
        const Other = await requireModule<any>('WASignalOther')

        let rec = await this.store.loadSenderKey(senderKeyName)
        if (
            !rec ||
            !rec._state ||
            !Array.isArray(rec._state.senderKeyStates) ||
            rec._state.senderKeyStates.length === 0
        ) {
            const signingKP = Keys.makeKeyPair()
            const chainKey = GroupSession.makeSenderKeyChainKey(0, Keys.makeRawSenderKey())
            const state = GroupSession.makeSenderKeyState(
                Keys.serializePubKey(signingKP),
                signingKP.privateKey,
                chainKey,
                Other.makeSenderKeyId(),
                []
            )
            const rawSession = { senderKeyStates: [GroupSession.serializeSenderKeyState(state)] }
            rec = new SenderKeyRecord(rawSession)
            await this.store.storeSenderKey(senderKeyName, rec)
        }

        const internal = await this._normalizeInternal(rec._state)
        const latestMaybe = internal.senderKeyStates[internal.senderKeyStates.length - 1]
        const latestInternal =
            latestMaybe &&
            (latestMaybe as any).senderKeyChainKey &&
            (latestMaybe as any).senderSigningKeyPublic
                ? latestMaybe
                : GroupSession.parseSessionFromRecord({ senderKeyStates: [latestMaybe] })
                      .senderKeyStates[0]
        const distributionBytes = GroupCipher.createSenderKeyDistributionProto(latestInternal)
        return new SenderKeyDistributionMessage(null, null, null, null, distributionBytes)
    }

    async process(senderKeyName: any, distributionMsg: { serialize(): Uint8Array }) {
        await bootstrap()
        const GroupCipher = await requireModule<any>('WASignalGroupCipher')
        const GroupSession = await requireModule<any>('WASignalGroupSession')

        let rec = await this.store.loadSenderKey(senderKeyName)
        if (!rec) rec = new SenderKeyRecord()

        const internal = await this._normalizeInternal(rec._state)
        const updated = await GroupCipher.processSenderKeyDistributionMsg(
            distributionMsg.serialize(),
            internal
        )
        if (!updated || !updated.success) {
            const err = updated && updated.error ? updated.error : 'unknown'
            throw new Error(`processSenderKeyDistributionMsg failed: ${err}`)
        }
        const serialized = GroupSession.serializeSession(updated.value)
        await this.store.storeSenderKey(senderKeyName, new SenderKeyRecord(serialized))
    }
}
