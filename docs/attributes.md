# Principal attributes

After `clerkAuth()` succeeds, eve exposes the caller as `ctx.session.auth.current`. The outer shape is the same for every token type:

```ts
{
  authenticator: 'clerk',
  principalType: 'user' | 'machine',
  principalId: string,
  subject: string,
  attributes: { /* per token type, see below */ },
}
```

`attributes` differs by `tokenType`:

## Session token

`principalType: 'user'`

```ts
{ tokenType: 'session_token', orgId?, role?, permissions?, name? }
```

## API key

`principalType: 'machine'`. `userId` and `orgId` are mutually exclusive depending on the key's subject.

```ts
{ tokenType: 'api_key', scopes?, userId?, orgId? }
```

## M2M token

`principalType: 'machine'`

```ts
{ tokenType: 'm2m_token', scopes? }
```

## OAuth token

`principalType: 'machine'`

```ts
{ tokenType: 'oauth_token', scopes?, userId, clientId }
```
