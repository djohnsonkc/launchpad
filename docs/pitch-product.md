# Launchpad — For Product Teams

## From idea to a working prototype people can click

Mockups and slide decks only go so far. The fastest way to learn whether an idea works is to put a **working prototype** in front of customers, stakeholders, and your own team, then watch what happens.

Launchpad makes that the easy part. Build a prototype, deploy it in minutes, and share a link. No tickets, no waiting on a release train, no infrastructure to set up.

## Why product teams use Launchpad

**Prototype at the speed of your ideas.** AI coding tools such as Claude Code now let product managers and designers build real, interactive frontends in an afternoon. Launchpad closes the last gap: getting that prototype off your laptop and onto a URL anyone can open.

**Share a link, not a screen recording.** Every deployed prototype gets its own address, like `/apps/growth/onboarding-v2/`. Stakeholders click through the real thing on their own time, on their own device.

**Test with real users sooner.** Put a working flow in front of customers during discovery, before engineering commits to a build. Validate the idea, then hand over something concrete.

**Iterate without ceremony.** Got feedback on Tuesday? Redeploy on Tuesday. Deploying again to the same app name updates the same link, so everyone always sees the latest version.

**Explore variations side by side.** Deploy `checkout-a` and `checkout-b` and compare them directly, or keep an earlier version around while you try a bolder direction.

**Never break anyone else's work.** Each prototype is fully independent. Deploying or changing yours can't affect another team's app, and theirs can't affect yours.

## How it works

1. **Build your prototype** with any frontend tool: React, Vue, Angular, plain HTML, or whatever your AI coding assistant produces.
2. **Deploy it.** In Claude Code, run `/launch` with the path to your project. It builds, packages, and uploads the app, then hands you the link. Prefer to do it by hand? Zip the build output folder and upload it to Launchpad's deploy endpoint.
3. **Share the link.** Your prototype is live and appears on the Launchpad dashboard, grouped by team.
4. **Iterate.** Make changes, run `/launch` again, and the same link shows the new version.

## Good fits

- Clickable prototypes for stakeholder reviews and roadmap conversations
- Usability tests and customer discovery sessions
- Concept explorations and A/B design directions
- Internal tools and dashboards that need to exist this week, not next quarter
- Demos for sales, leadership, or all-hands

## What to know before you start

Launchpad hosts **frontend** apps: anything that builds into a folder of static files (HTML, CSS, JavaScript, images). That covers most prototypes. If your prototype needs data, it can use mock data bundled into the app or call an API that already exists. Launchpad doesn't run custom backends or databases.

Prototypes are meant to move fast, so treat what you deploy as you would any shared link. Don't put real customer data into a prototype.

## From prototype to product

A prototype on Launchpad isn't a dead end. Because it's a real, running app, engineering can pick up exactly what you validated — the flows, the interactions, the edge cases you discovered — rather than reinterpreting a static mockup. When an idea graduates, it can keep living on Launchpad as a production app, deployed and released independently by the team that owns it.

Curious how it works under the hood? See [Engineers](/pitch/tech-leads). Making the case for the platform? See [Executives](/pitch/exec).
