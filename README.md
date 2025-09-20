# libsignal-waweb (TypeScript)

A small, TypeScript-first facade that exposes a libsignal-like API on top of the deobfuscated WhatsApp Web crypto modules, with a friendly developer experience and Node.js-first runtime.

This project is inspired by Signal's libsignal, but it is not a drop-in replacement and is not maintained by Signal. It aims to provide a clean, minimal surface to bootstrap sessions, encrypt/decrypt messages, and handle group sender keys using the WA Web crypto building blocks.

> Important: This library is experimental, unaudited, and not guaranteed to be interoperable with any official client. Do not rely on it for production or security-critical uses without a thorough security review.

---

## Features at a glance

- **ESM + TypeScript**: ships type declarations and compiles to `dist/`.
- **Module bootstrap**: `bootstrap()` dynamically registers all WA Web crypto modules.
- **libsignal-like helpers**: helpers for identities, prekeys, signed prekeys.
- **Session management**: `SessionBuilder` and `SessionCipher` for encrypt/decrypt.
- **Groups**: `GroupSessionBuilder` and `GroupCipher` for SenderKey distribution and messages.
- **Path independent modules**: the internal `modules/` are resolved via absolute filesystem paths derived from `import.meta.url`, working regardless of where the library is installed.

---

## Requirements

- Node.js 18+ (ESM, `import.meta.url`, and URL-to-path resolution).
- The `modules/` directory must be distributed alongside the package (this repository includes it). The runtime resolves absolute paths to these files, compatible with `fs.readFile` consumers under the hood.

---

## Install

This repo is set up as a standard npm package. You can clone it and install dependencies:

```bash
npm install
npm run build
```

If you publish to a registry, consumers can install it normally:

```bash
npm install libsignal-waweb
```

---

## Quick start

```ts
import {
    bootstrap,
    ProtocolAddress,
    SessionBuilder,
    SessionCipher,
    GroupSessionBuilder,
    GroupCipher,
    SenderKeyName,
    generateIdentity,
    generatePreKeys,
    generateSignedPreKey
} from 'libsignal-waweb'

// You provide your own store implementations (in-memory example below)
class MemoryStore {
    sessions = new Map<string, any>()
    senderKeys = new Map<string, any>()
    our = { regId: 0, privKey: new Uint8Array(32), pubKey: new Uint8Array(32) }
    preKeys = new Map<number, any>()
    signedPreKeys = new Map<number, any>()

    async getOurRegistrationId() {
        return this.our.regId
    }
    async getOurIdentity() {
        return this.our
    }
    async loadSession(addr: string) {
        return this.sessions.get(addr)
    }
    async storeSession(addr: string, rec: any) {
        this.sessions.set(addr, rec)
    }
    async loadSenderKey(name: any) {
        return this.senderKeys.get(String(name))
    }
    async storeSenderKey(name: any, rec: any) {
        this.senderKeys.set(String(name), rec)
    }
    async loadPreKey(id: number) {
        return this.preKeys.get(id)
    }
    async removePreKey(id: number) {
        this.preKeys.delete(id)
    }
    async loadSignedPreKey(id: number) {
        return this.signedPreKeys.get(id)
    }
}

;(async () => {
    await bootstrap()

    // Identity and prekeys
    const store = new MemoryStore()
    const { regId, staticKeyPair } = await generateIdentity()
    store.our = { regId, privKey: staticKeyPair.privateKey, pubKey: staticKeyPair.publicKey }

    const preKeys = await generatePreKeys(1, 10)
    for (const pk of preKeys) store.preKeys.set(pk.id, pk)
    const spk = await generateSignedPreKey(staticKeyPair, 1)
    store.signedPreKeys.set(1, { ...spk, id: 1 })

    // Build a peer address and session
    const addr = new ProtocolAddress('peer@example.com', 1)
    const sb = new SessionBuilder(store as any, addr)
    // Provide a bundle compatible with the deobfuscated code expectations
    await sb.initOutgoing({
        identityKey: staticKeyPair.publicKey,
        signedPreKey: { id: 1, publicKey: staticKeyPair.publicKey }
        // Optional: preKey / ratchetKey if needed by your flow
    })

    const sc = new SessionCipher(store as any, addr)
    const encrypted = await sc.encrypt(new TextEncoder().encode('hello'))
    const plaintext = await sc.decryptWhisperMessage(encrypted.body)
    console.log('Plaintext:', new TextDecoder().decode(plaintext))

    // Groups (SenderKey example)
    const gsb = new GroupSessionBuilder(store as any)
    const skName = new SenderKeyName('group-123', addr)
    const distributionMsg = await gsb.create(skName)

    // Another participant processes the distribution message then encrypts
    await gsb.process(skName, distributionMsg)
    const gc = new GroupCipher(store as any, skName)
    const groupCiphertext = await gc.encrypt(new TextEncoder().encode('hello group'))
    const groupPlain = await gc.decrypt(groupCiphertext)
    console.log('Group plaintext:', new TextDecoder().decode(groupPlain))
})()
```

---

## Build from source

```bash
npm install
npm run build
```

Outputs will be written to `dist/` with ESM `.js` files and `.d.ts` typings.

---

## Caveats and security

- This project is not affiliated with Signal or WhatsApp.
- The cryptographic code path is derived from deobfuscated WA Web modules; correctness and security are not guaranteed.
- Use for research/experimentation. For production, subject the code to rigorous review and testing.

---

## License

All rights reserved — please check with the author before using in production.
