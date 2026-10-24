# Agrieasy.ai

Our AI saathi for agrieasy.site. The idea is simple - a farmer should be able to just talk to the app in hindi or english (voice or typing) and get real answers: crop problems, khaad paani ka samay, keere, sarkari yojana, and most importantly how to sell the produce on Agrieasy and get paid fast.

It also makes a full season plan. Pick the crop, acres and sowing date and it gives a dated schedule from land prep till selling, with expected cost and income.

Try it: https://rishabh01487.github.io/Agrieasy.ai/
(mirror: https://rishabhthe1-agrieasy-ai.static.hf.space)

Open on phone and use "add to home screen" to install it.

## Folders

- app/ - the pwa
- knowledge/ - the farming notes the saathi answers from. keep improving these, this is the real brain
- finetune/ - dataset + notebook to train our own model (runs on kaggle or colab, free tier is enough)
- dev/ - deploy scripts i use

## Running locally

```
cd app
npx http-server -p 8080
```

## How the ai part works

Answers come from the built in knowledge base, and optionally a cloud model if you add an api key in settings. Our own fine tuned model (qwen 2.5 1.5b) is being trained right now, once its ready the app can download it and run it on the phone itself, settings already have the field for it.

## Disclaimer stuff

All numbers are indicative for india, confirm doses with your KVK. Pesticides as per label only. We never make up market prices, the app always points to live prices.
