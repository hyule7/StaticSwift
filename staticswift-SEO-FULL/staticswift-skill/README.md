# StaticSwift skill

The portable design + voice system for StaticSwift — Harry Yule's UK editorial
website business in Manchester. Use this skill whenever building, redesigning,
auditing, or copywriting in the StaticSwift style.

## Install

### Via skillfish

```bash
npx skillfish add YOUR_USERNAME/staticswift
```

Replace `YOUR_USERNAME` with your GitHub username after you push this folder
to a public repo named `staticswift` (or whatever you'd like to call it).

### Manual

Copy `SKILL.md` into your local Claude skills directory:

```
~/.claude/skills/staticswift/SKILL.md
```

## What's inside

- Brand identity (Harry, £149, Manchester, voice)
- Strict colour palette (warm ink, paper, terracotta — no #000 / #fff)
- Typography stack (Boska italic + Switzer + JetBrains Mono)
- 17 anti-AI tells to hunt + replace
- Voice patterns (Harry-direct, specific, modest)
- Layout patterns (editorial, asymmetric, no card-soup)
- Motion guidelines (different bezier per section)
- Accessibility + dev signals (skip-link, time, print, console)
- Conversion tactics (sticky CTA, social-proof toasts, exit-intent)
- Admin features (autopilot, prospects, drafts editor)
- File structure for new sites
- 14-item pre-ship checklist

## How to publish

```bash
cd staticswift-skill
git init
git add SKILL.md README.md
git commit -m "Initial StaticSwift skill"
git remote add origin https://github.com/YOUR_USERNAME/staticswift.git
git push -u origin main
```

Then anyone (including your future self on a new machine) can:

```bash
npx skillfish add YOUR_USERNAME/staticswift
```

## License

MIT © Harry Yule
