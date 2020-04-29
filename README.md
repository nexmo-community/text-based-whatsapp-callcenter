# text-based-whatsapp-callcenter

Demo app routing user enquiries to customer service people all over WhatsApp

## Prerequisites

* Nexmo Account you can signup [here](https://dashboard.nexmo.com/sign-up)
* Need WhatsApp business number - This sample was created using the [Messages API Sandbox](https://developer.nexmo.com/messages/concepts/messages-api-sandbox) - this is purely meant as a test sandbox - to adapt this to your use case you will want to have your own WhatsApp Business Account - contact sales to get setup - check out our [product page](https://www.vonage.com/communications-apis/messages/features/whatsapp/) for more details
* If you are using the sandbox all numbers you test with must be whitelisted to the sandbox - see sandbox article above for more details
* NPM
* Redis

## Setup

1. Copy the .env.example to .env
2. Fill in the env variables - Private key is expected on one line with all newlines replaced with `\n`
3. Fill in `AGENT_NUM` and `AGENT_NUM2` with the numbers you'd like to act as Agents
4. Execute `node index.js` in your terminal
5. Point inbound messages webhook at `SITE_BASE/webhooks/inbound` and the status webhook at `SITE_BASE/webhooks/status` 

> NOTE if you are using the sandbox, webhooks will be defined at the sanbox level

## Usage

* Your agent numbers can text `sign in` to the WhatsApp number, the WhatsApp number will respond back that they have signed in.
* Your customer numbers will then message in with questions.
* Customer messages will be forwarded to the appropriate agent with an emoji prepended to the message.
* Agent can then respond, with the appropriate emoji at the beginning of their line and the message will be forwarded back to the user
* If the Agent sends a `sign out` message to the end point, their customer's will be reallocated to available agents. If there are no available agents then the whatsApp number will tell the customer there are no available agents.
