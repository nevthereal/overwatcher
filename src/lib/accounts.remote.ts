import * as v from 'valibot'
import { invalid } from '@sveltejs/kit'
import { command, form, query } from '$app/server'
import { connect, connectionStatuses } from '#lib/server/deployments.js'
import { host } from '#lib/server/host.js'
import { tokenFromGhCli } from '#lib/server/providers/github.js'
import { removeCredential } from '#lib/server/store.js'
import { getDeployments } from './deployments.remote.js'

const provider = v.picklist(['vercel', 'railway', 'github'])

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

export const getConnections = query(async () => connectionStatuses())

function afterChange() {
	void getConnections().refresh()
	getDeployments().reconnect()
}

export const connectAccount = form(
	v.object({
		provider,
		token: v.pipe(v.string(), v.trim(), v.nonEmpty('Paste a token first'))
	}),
	async ({ provider, token }, issue) => {
		if (host().demo) invalid('Connecting accounts is disabled in demo mode.')
		let account: string
		try {
			account = await connect(provider, token)
		} catch (err) {
			invalid(issue.token(message(err)))
		}
		afterChange()
		return { account }
	}
)

export const disconnectAccount = form(v.object({ provider }), async ({ provider }) => {
	if (host().demo) invalid('Disconnecting accounts is disabled in demo mode.')
	removeCredential(provider)
	afterChange()
})

/** Connects GitHub with the token of a logged-in GitHub CLI (`gh auth token`). */
export const connectGithubFromCli = command(async () => {
	const account = await connect('github', await tokenFromGhCli())
	afterChange()
	return account
})
