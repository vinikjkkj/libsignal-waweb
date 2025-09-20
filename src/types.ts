export interface ISenderKeyStore {
    loadSenderKey(senderKeyName: any): Promise<any>
    storeSenderKey(senderKeyName: any, record: any): Promise<void>
}

export interface ISessionStore {
    getOurRegistrationId(): Promise<number>
    getOurIdentity(): Promise<any>
    loadSession(address: string): Promise<any>
    storeSession(address: string, record: any): Promise<void>
    loadSignedPreKey(id: number): Promise<any>
    loadPreKey(id: number): Promise<any>
    removePreKey?(id: number): Promise<void>
}

export type Bytes = Uint8Array
