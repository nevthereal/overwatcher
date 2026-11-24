import * as v from 'valibot'
import { invalid } from '@sveltejs/kit'
import { form, query } from '$app/server'
import { connect, connectionStatuses, invalidateDeployments } from '#lib/server/deployments.js'
import { DEMO } from '#lib/server/demo.js'
import { requireUser } from '#lib/server/session.js'
import { removeConnection } from '#lib/server/store.js'
import { getDeployments } from './deployments.remote.js'

const provider = v.picklist(['vercel', 'railway', 'github'])

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

export const getConnections = query(async () => connectionStatuses(requireUser().id))

function afterChange(userId: string) {
	invalidateDeployments(userId)
	void getConnections().refresh()
	void getDeployments().refresh()
}

export const connectAccount = form(
	v.object({
		provider,
		_token: v.pipe(v.string(), v.trim(), v.nonEmpty('Paste a token first'))
	}),
	async ({ provider, _token: token }, issue) => {
		const user = requireUser()
		if (DEMO) invalid('Connecting accounts is disabled in demo mode.')
		let account: string
		try {
			account = await connect(user.id, provider, token)
		} catch (err) {
			invalid(issue._token(message(err)))
		}
		afterChange(user.id)
		return { account }
	}
)

export const disconnectAccount = form(v.object({ provider }), async ({ provider }) => {
	const user = requireUser()
	if (DEMO) invalid('Disconnecting accounts is disabled in demo mode.')
	await removeConnection(user.id, provider)
	afterChange(user.id)
})
