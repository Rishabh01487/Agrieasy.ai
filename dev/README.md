# dev/ — deployment & training scripts

These scripts run the pipeline from the command line — push code, run training on
Kaggle's free GPUs, publish the model.

## Required credentials (3 tokens, create in ~5 minutes)

| # | Token | Where to create | What I do with it |
|---|---|---|---|
| 1 | **Kaggle API key** (kaggle.json contents: username + key) | kaggle.com → your icon → Settings → API → *Create New Token* | `kaggle_push.sh` starts a **private GPU kernel** that builds the dataset and fine-tunes the model; `kaggle_status.sh` polls until done, then pulls logs/model |
| 2 | **Hugging Face write token** (`hf_...`) | huggingface.co → Settings → Access Tokens → *New token* → type **write**, fine-grained, only *Write access to public repos* | Uploads the dataset + fine-tuned model to your HF account (free hosting, shareable) |
| 3 | **GitHub token** (classic, `repo` scope) | github.com → Settings → Developer settings → Personal access tokens | Pushes this repo + publishes the PWA on **GitHub Pages** (free HTTPS hosting). Skip if you'd rather host `app/` on your own agrieasy.site server |

Optional 4: **Groq free API key** (console.groq.com) — instant 70B-quality cloud mode in
the PWA's Settings, no training involved.

## Security rules
- Tokens ≠ passwords. I only need the token string; **never send account passwords**, OTPs, or card data.
- Prefer fine-grained tokens with minimum scopes; **revoke them after launch** (each site has a one-click Revoke).
- The Kaggle kernel is created **private**. The GitHub repo can be public (needed for free Pages + the kernel's git clone); say the word and I keep it private + you upload `app/` to your own host instead.

## The run order (what happens when you paste the tokens)
```
./dev/github_push.sh          # code live  -> https://<you>.github.io/agrieasy-ai/  (PWA testable in 2 min)
./dev/kaggle_push.sh          # GPU kernel starts (REPO_URL=your GitHub URL is patched in automatically)
./dev/kaggle_status.sh        # I poll; on error I read the log, fix, re-push (30 GPU-hrs/week budget)
# done: model -> Hugging Face -> PWA Settings gains the custom model / server URL
```

## Files
- `github_push.sh` — create repo (if missing), commit + push, enable GitHub Pages on `/app`.
- `kaggle_push.sh` — upload the training notebook as a private GPU kernel (patched with your repo URL + optional `KAGGLE_HF_TOKEN` baked for the push-to-HF step; revoke the HF token after).
- `kaggle_status.sh` — poll kernel status, fetch logs and output files.

Env vars used: `KAGGLE_USERNAME`, `KAGGLE_KEY`, `GITHUB_TOKEN`, `GITHUB_REPO`,
`REPO_URL`, `KAGGLE_HF_TOKEN`, `HF_USERNAME`.
