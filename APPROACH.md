## What this is

Sonia Comment Assist is an internal web app I built for the growth team at Sonia Health. The goal is to help a human reviewer find relevant public posts and review AI drafted comments before anything is posted manually. I wanted the prototype to focus on the part of growth work that feels most repetitive: finding the right conversations, deciding whether they are safe to engage with, and drafting a thoughtful first comment. The tool does not post automatically, which was a very intentional choice because mental health conversations need human judgment and extra care. For this prototype, I focused on building a workflow that feels practical for a small growth team that wants to move faster without turning outreach into spam.

## Sourcing

For sourcing, I used a mix of controlled mock data and live Reddit ingestion. I created 25 hand crafted mock posts so that the prototype could test all seven of the safety categories we cared about: crisis language, minors, medical claims, diagnosis or cure language, privacy concerns, inappropriate intervention, and spam. I also built a live Reddit ingestor that pulls public posts from Reddit’s JSON endpoints without needing an API key. This gave me 30 total posts in the database, with 25 mocked posts and 5 live Reddit posts. I chose this hybrid setup because random live scraping would not reliably produce every safety edge case, and I wanted the demo to show the safety system clearly.

## Ingestion

The ingestion layer pulls post data into SQLite and stores the source, author handle, post body, permalink, and creation timestamp. For Reddit, the ingestor uses public JSON endpoints, so it avoids platform authentication issues and does not depend on Instagram or private APIs. I also added a hard denylist for high risk communities like r/SuicideWatch and r/selfharm, meaning those posts do not enter the pipeline at all. My thinking here was that some spaces are too sensitive for growth engagement, even if the AI could technically classify them. In production, I would rather have the system skip these communities completely than risk a comment that feels invasive or careless.

## Relevance ranking

Each post goes through a Claude classification step that assigns a relevance score from 0 to 100, checks audience match, and surfaces early safety flags. The reviewer queue is sorted by unreviewed posts first, then by highest relevance, so the most promising items appear at the top. I set the drafting threshold at a relevance score of 35, meaning posts below that score can still be reviewed but do not receive an AI generated draft. This keeps the system from wasting time drafting comments for posts that are only loosely connected to Sonia’s audience. I picked this threshold as a reasonable v1 cutoff because I wanted enough posts to make it through, while still filtering out weak matches.

## Drafting

If a post passes the safety checks and has a relevance score of at least 35, the system sends it to Claude to draft a comment. The drafting prompt includes rules around tone, safety, and not making claims about the original poster. I also added a cached system prompt and a sliding shape variety window so the drafts do not all start or sound the same.

If the draft includes an em dash or a banned opener, the system retries the generation. After the draft is created, it goes through another rule based safety filter so that unsafe language in the generated comment can still be caught before a human sees it as ready to approve. This mattered to me because the AI might classify the post correctly but still accidentally write something like a cure claim or overly personal advice.

## Reviewer flow

The reviewer experience is a local web app running at localhost:3000. The page shows a queue of posts, with each card containing the original post, the AI draft, an editable text area, and buttons to approve, reject, or mark unsafe. If the reviewer changes the draft and approves it, the system logs that decision as an edit instead of a normal approval. I added that distinction because approving an untouched AI draft is different from a reviewer rewriting it and then approving their own version. Decisions persist in the database, so the team can look back and understand what happened for each post. This makes the tool feel more like a review system than just a comment generator.

## Data stored

The data is stored in SQLite using three tables: posts, drafts, and decisions. The posts table stores the basic public post data, including the source, author handle, body, permalink, and timestamp. The drafts table stores the relevance score, rationale, topic tags, draft comment, safety flags, blocked reason, and model used. The decisions table is append only and stores reviewer actions like approve, edit, reject, or unsafe, along with the edited comment, reviewer note, and decision time. I used SQLite because it was simple, local, and enough for proving the workflow without adding unnecessary infrastructure. For a prototype like this, I cared more about getting the review loop working than scaling the database too early.

## What's mocked

The mocked part of the project is the set of 25 hand crafted posts. I included these because I needed every safety category to have at least one test case in the demo. The real part is the Reddit ingestion, which works against live public JSON endpoints without authentication. The prototype does not touch Instagram, so it avoids getting blocked by Instagram API restrictions or scraping problems. Most importantly, nothing is automatically posted anywhere. The tool stops at the point where a human reviewer sees the draft, and any actual posting would happen manually outside the app. That boundary is important because mental health outreach should stay human reviewed.

## Risks and mitigations

The biggest safety risk is a false negative, where the system misses something unsafe and drafts a comment anyway. I mitigated that with two layers of filtering: Claude classification flags and rule based safety checks on both the original post and the generated comment. Another risk is false positives, where the system blocks posts that might actually be safe. I handled that by designing the system with a reviewer override path, since the goal is to support human judgment rather than replace it. Brand voice drift is another risk, so I used a style guide, banned openers, and retries to keep the drafts from sounding too generic or too AI written.

I also considered platform TOS concerns, API key leakage, and hallucinated assumptions about the original poster. To reduce those risks, the app does not auto post, stores secrets in .env.local, and tells the model not to claim anything about people it does not know. Overall, I biased the system toward caution because the product space is mental health.

## What I'd build next

If I were turning this into a production tool, the first thing I would add is multi reviewer support with role based assignment. That would make it easier for a growth lead to assign posts, review decisions, and separate normal approvals from sensitive cases. I would also add platform specific posting integrations, but only with strict rate limits, cooldowns, daily caps, and clear human confirmation. Another next step would be a reviewer feedback loop where edited and rejected comments are used to improve the drafting prompt or train a more consistent drafter. I would also add A/B testing for prompts based on real reply rates and an analytics dashboard showing decision speed, approval rate by topic, and comment performance after posting. Longer term, I would add per creator memory so the system can recognize when Sonia has already engaged with the same person too many times recently and should back off. That matters because good growth should feel helpful, not spammy.
