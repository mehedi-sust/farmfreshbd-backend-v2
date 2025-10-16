This directory contains Express router modules used by the single serverless entry `api/index.js`.

All files here are standard Express `Router` modules (not Vercel function entrypoints). They are mounted inside `api/index.js` to preserve endpoint paths and request/response behavior.

Moving these out of the `api/` folder ensures Vercel only creates one Serverless Function for deployments on the Hobby plan.