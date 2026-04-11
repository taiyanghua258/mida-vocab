# Task Checklist: Validation Fixes 

- [x] 1. Backend: Implement `/ai/generate-pos` in `backend/routes/ai.js` to correct part of speech.
- [x] 2. Frontend: Update `dictImportModal` to include an "AI Fix Part of Speech" toggle.
- [x] 3. Frontend: Modify `handleDictBatchImport` to selectively process chunks through `/ai/generate-pos` if enabled.
- [x] 4. Frontend: Refactor `renderPagination` to use windowed pagination limits (`[首] [上一页] 1 2 3 [下一页] [末]`).
- [x] 5. Frontend: Fix Undo Bug 5 by resetting peeling states of card DOM on undo.
- [x] 6. Backend: Enhance `studyController.js` logic for `getDueWords` and `getStats` to auto-pull postponed words when daily quota changes.
- [x] 7. Frontend: Revise `formatDate` output to display "排队中(明日安排)" instead of "8小时后" for words pushed due to quota.
