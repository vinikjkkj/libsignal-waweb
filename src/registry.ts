import { ModuleRegistry, registerAll } from 'wa-modules-loader'
import { fileURLToPath } from 'url'
import path from 'node:path'

const registry = new ModuleRegistry()
let registered = false

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const modulesBaseDir = path.resolve(__dirname, '../modules')
const m = (file: string) => path.join(modulesBaseDir, file)

const MODULES = [
    { name: 'WASignalCipher', path: m('WASignalCipher.js') },
    { name: 'WASignalGroupCipher', path: m('WASignalGroupCipher.js') },
    { name: 'WASignalGroupSession', path: m('WASignalGroupSession.js') },
    { name: 'WASignalKeys', path: m('WASignalKeys.js') },
    { name: 'WASignalLocalStorageProtocol.pb', path: m('WASignalLocalStorageProtocol.pb.js') },
    { name: 'WASignalOther', path: m('WASignalOther.js') },
    { name: 'WASignalSessions', path: m('WASignalSessions.js') },
    { name: 'WASignalSignatures', path: m('WASignalSignatures.js') },
    { name: 'WASignalWhisperTextProtocol.pb', path: m('WASignalWhisperTextProtocol.pb.js') },
    { name: 'WASignalWhitepaper', path: m('WASignalWhitepaper.js') },
    { name: 'WASignalAggregator', path: m('WASignalAggregator.js') },

    { name: 'WABinary', path: m('WABinary.js') },
    { name: 'WAProtoConst', path: m('WAProtoConst.js') },
    { name: 'WABaseProto', path: m('WABaseProto.js') },
    { name: 'WAHasProperty', path: m('WAHasProperty.js') },
    { name: 'WAProtoCompile', path: m('WAProtoCompile.js') },
    { name: 'WAProtoUtils', path: m('WAProtoUtils.js') },
    { name: 'WAProtoValidate', path: m('WAProtoValidate.js') },
    { name: 'WACryptoAesGcm', path: m('WACryptoAesGcm.js') },
    { name: 'WACryptoDependencies', path: m('WACryptoDependencies.js') },
    { name: 'WACryptoEd25519', path: m('WACryptoEd25519.js') },
    { name: 'WACryptoHkdf', path: m('WACryptoHkdf.js') },
    { name: 'WACryptoHmac', path: m('WACryptoHmac.js') },
    { name: 'WACryptoLibrary', path: m('WACryptoLibrary.js') },
    { name: 'WACryptoLibraryConfig', path: m('WACryptoLibraryConfig.js') },
    { name: 'WACryptoPrimitives', path: m('WACryptoPrimitives.js') },
    { name: 'WACryptoSha256', path: m('WACryptoSha256.js') },
    { name: 'WACryptoUtils', path: m('WACryptoUtils.js') },
    { name: 'WATypedArraysCast', path: m('WATypedArraysCast.js') },
    { name: 'WALogger', path: m('WALogger.js') },
    { name: 'WALoggerUtils', path: m('WALoggerUtils.js') },
    { name: 'WAResultOrError', path: m('WAResultOrError.js') },
    { name: 'WALongInt', path: m('WALongInt.js') },
    { name: 'WAHex', path: m('WAHex.js') },
    { name: 'WAParsableXmlNode', path: m('WAParsableXmlNode.js') },
    { name: 'decodeProtobuf', path: m('decodeProtobuf.js') },
    { name: 'encodeProtobuf', path: m('encodeProtobuf.js') }
]

export async function bootstrap() {
    if (registered) return registry
    await registerAll(registry, MODULES)
    await registry.registerAsync('tweetnacl', import('tweetnacl'))
    registered = true
    return registry
}

export async function requireModule<T = any>(name: string): Promise<T> {
    await bootstrap()
    return registry.require(name)
}

// Convenience accessors for common modules
export async function getSignalKeys() {
    return requireModule('WASignalKeys')
}
export async function getSignalCipher() {
    return requireModule('WASignalCipher')
}
export async function getSignalGroupCipher() {
    return requireModule('WASignalGroupCipher')
}
export async function getSignalSessions() {
    return requireModule('WASignalSessions')
}
export async function getSignalWhitepaper() {
    return requireModule('WASignalWhitepaper')
}
export async function getSignalSignatures() {
    return requireModule('WASignalSignatures')
}
