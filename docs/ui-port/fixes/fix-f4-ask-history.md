# fix-f4-ask-history — Ask VCFO past chats come from the server (owner item F4)

Branch `fix/f4`. No schema change. No migration. The app was not run (owner testing rule).

| No. | Status | Item | What changed |
|---|---|---|---|
| 1 | ✓ | Repository list | `listOwnAskConversations(ctx, { shell, engagementId, page })` in `src/db/repositories/ask-conversations.ts`. It returns id, title, updated time and message count. The title is the first question, trimmed to 80 characters. The order is newest first. The page size is 40. The filter is `profile_id = ctx.userId`. No role makes it wider. Chats with no message are not shown. |
| 2 | ✓ | Repository delete | `deleteOwnAskConversation(ctx, id)`. The filter is the id and `profile_id = ctx.userId`. The messages go with the chat (cascade). |
| 3 | ✓ | Cross-user tests | `src/db/repositories/ask-repositories.test.ts`. User A never gets user B's id in the query. An admin gets only their own chats. B cannot delete A's chat. A developer is refused before a query. |
| 4 | ✓ | `GET /api/ask/conversations` | New route. Query `shell`, `engagementId`, `page`. Guard `requireAsk`. The response has `conversations` and `hasMore`. |
| 5 | ✓ | `DELETE /api/ask/conversations/[id]` | New handler. Guard `requireAsk`. A chat of another user gives 404. |
| 6 | ✓ | Full page list | `AskProvider` reads the list with React Query (key `ask, conversations, user, shell, engagement`). The full page shows that list. |
| 7 | ✓ | Offline fallback | localStorage `vcfo.ask.history.<userId>` is still written. It is read only when the server list fails. Test: `src/components/ask/__tests__/ask-full-page.test.tsx`. |
| 8 | ✓ | List refresh | The list refreshes when an answer starts or continues a chat, when a topic answer is saved, and on "New chat". |
| 9 | ✓ | Suggested-question answers | `POST /api/ask/topics/[slug]` builds the same answer as GET. Then `recordTopicExchange` (`src/lib/ask/topic-record.ts`) saves the question and the answer in the chat. The chat rule is the pipeline rule: same owner, same shell, same engagement, or a new chat. `showTopic` in the pop-up now uses POST. Test: `src/lib/ask/__tests__/topic-record.test.ts`. |
| 10 | ✓ | Answer behaviour | The topic answer is the same. No model is called. No model is stored, so the rate limit does not count it. If the save fails, the answer still shows. |
| 11 | ◐ | Later model answers | A later free-text question in the same chat now sends the saved topic turns as history to the model (last 6 messages). This is the same text that the person sees. |
| 12 | ✗ | Delete button | Not in the task. The API and `deleteConversation()` in `src/hooks/ask/ask-api.ts` are ready for it. |
| 13 | ✗ | Paging UI | The page shows the first 40 chats. The API has `page` and `hasMore` for a "More" button later. |
| 14 | ✓ | Checks | `tsc --noEmit`, `eslint` on the changed files, and `vitest` on the Ask tests (repositories, topic record, pipeline, mock evals, panel, full page). |
