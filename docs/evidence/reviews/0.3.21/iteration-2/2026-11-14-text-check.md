# Fabric 0.3.21: text check of the release's new strings

The 0.3.21 review, iteration 2, PL-12 (the operator's rule of 2026-10-25: every new person-visible string checked with
the text check in each locale it ships in). Checked 2026-11-14 with the text checker's batch check, register `ui`, no saved
voice (none is attached to Fabric), 22 texts: the 11 strings added since `0d729bbe` in `en.ts` and `ru.ts`, at the
iteration-2 candidate. No finding blocks. The one suggestion, `ru-ui-trailing-period` on
`launch.board.delegate.answer`, is kept: that string is the sentence recorded as the question's answer, not a label.

| Key | Locale | Report | Findings |
|---|---|---|---|
| `attention.swept.request-no-folder` | ru-RU | `6b8ae3c9-c735-4f55-ae47-03323b6a3281` | none |
| `access.connect.wrong-handler` | ru-RU | `962ebb39-2978-4072-b7be-a30a0312c44e` | none |
| `rail.board` | ru-RU | `e3fbbf13-dc02-48d7-a267-d18c814dac9f` | none |
| `rail.boardWaiting` | ru-RU | `e9784a3e-96fd-49b2-85c3-d41c72d03cac` | none |
| `launch.board.recommended` | ru-RU | `6a8b936c-fe48-4fdd-969c-811cab23c4f8` | none |
| `launch.board.delegate` | ru-RU | `3b99fad1-0871-4e40-b1f3-82ce74706ed3` | none |
| `launch.board.delegate.hint` | ru-RU | `4fba77ff-3c78-4a17-add8-19e105aee449` | none |
| `launch.board.delegate.answer` | ru-RU | `278b7dab-fee3-43b0-aa9e-8a26edd12252` | ru-ui-trailing-period (suggestion) |
| `launch.board.own` | ru-RU | `82fa5a43-63e9-426e-a915-8e2e38cd726e` | none |
| `launch.board.decide.details` | ru-RU | `6aa7036d-5afb-42cc-ba00-631b493d6d63` | none |
| `harness.tool.fabric_board_search` | ru-RU | `25a0a2ff-ffac-46f6-9cd5-22d08c746edf` | none |
| `attention.swept.request-no-folder` | en-US | `c29771e7-370c-4df1-80a5-4c3dc4ba1361` | none |
| `access.connect.wrong-handler` | en-US | `ca4a94f3-5248-4186-ac76-8fffc75141b7` | none |
| `rail.board` | en-US | `689c50b1-d64c-49dc-a662-fc8da6d45bc8` | none |
| `rail.boardWaiting` | en-US | `eb022f34-35a1-4e40-be23-d2e71eb0fecd` | none |
| `launch.board.recommended` | en-US | `14fa4b72-833a-4d79-a5d6-7f1a87f349f1` | none |
| `launch.board.delegate` | en-US | `a7039e81-8856-4240-b335-bee134ffba0c` | none |
| `launch.board.delegate.hint` | en-US | `32a28ac0-5f1c-4fe4-afff-0b86f02e6a23` | none |
| `launch.board.delegate.answer` | en-US | `21ebcc2c-841e-43da-ae97-cd164eb9e1ce` | none |
| `launch.board.own` | en-US | `90340321-ff0d-4ba7-9566-a4d2edef4abb` | none |
| `launch.board.decide.details` | en-US | `a5a485e0-6fd3-4b9d-8238-01e87b60be8f` | none |
| `harness.tool.fabric_board_search` | en-US | `b5df88b9-11e2-4423-b42f-bdb091146dc7` | none |

## Re-checked after the iteration-2 and iteration-3 rewrites

The 0.3.21 review, iteration 3 (PL-18, DO-20): `attention.swept.request-no-folder` changed after the candidate above,
first in the iteration-2 wave (UX-7) and again in the iteration-3 wave (clearer Russian: «попросите агента проекта,
который отправил запрос, снять его»). Both wordings were checked the same way, register `ui`, none with a finding.

| Key | Locale | Wording | Report | Findings |
|---|---|---|---|---|
| `attention.swept.request-no-folder` | ru-RU | the iteration-2 wave (`7b5a7205`) | `8eb58aa0-eb7d-4cdf-b869-1013f5b2d64b` | none |
| `attention.swept.request-no-folder` | en-US | the iteration-2 wave (`7b5a7205`) | `a55c2ab4-af38-4731-8f5b-d7bc2e5d2414` | none |
| `attention.swept.request-no-folder` | ru-RU | the iteration-3 wave (shipped) | `d180f99f-a2a8-4041-807b-f1bdc147fc2e` | none |
| `attention.swept.request-no-folder` | en-US | the iteration-3 wave (shipped) | `be856855-7b93-4e76-832f-57d560bf2f06` | none |
