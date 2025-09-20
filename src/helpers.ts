import { requireModule, getSignalKeys, getSignalSignatures } from './registry'

export async function generateIdentity() {
    const Keys = await getSignalKeys()
    const kp = Keys.makeKeyPair()
    const Other = await requireModule<any>('WASignalOther')
    const regId = Other.makeRegistrationId('extendedRange')
    return { regId, staticKeyPair: kp }
}

export async function generatePreKeys(startId = 1, count = 100) {
    const Keys = await getSignalKeys()
    return Keys.makePreKeys(startId, count)
}

export async function generateSignedPreKey(identityKeyPair: any, idNumeric: number) {
    const Signatures = await getSignalSignatures()
    if (typeof Signatures.generateSignedPreKey === 'function') {
        return Signatures.generateSignedPreKey(identityKeyPair, idNumeric)
    }
    if (typeof Signatures.makeSignedPreKey === 'function') {
        return Signatures.makeSignedPreKey(identityKeyPair, idNumeric, identityKeyPair)
    }
    throw new Error('No signed prekey generator available in WASignalSignatures')
}
