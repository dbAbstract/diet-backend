/**
 * Boots the Fastify app, dumps the OpenAPI spec to openapi.json, then exits.
 * Usage: npm run generate-spec
 */
import Fastify from 'fastify'
import { app } from './app.js'
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const fastify = Fastify()
fastify.register(app)

await fastify.listen({ port: 0 }) // random available port

const { port } = fastify.server.address() as { port: number }
const response = await fetch(`http://localhost:${port}/documentation/json`)
const spec = await response.json()

const outPath = resolve(__dirname, '../openapi.json')
writeFileSync(outPath, JSON.stringify(spec, null, 2))

console.log(`OpenAPI spec written to ${outPath}`)
await fastify.close()
