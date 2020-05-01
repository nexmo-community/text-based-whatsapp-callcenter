# WhatsApp Demo For Text-Based Customer Service

<img src="https://developer.nexmo.com/assets/images/Vonage_Nexmo.svg" height="48px" alt="Nexmo is now known as Vonage" />

This is a basic demo app routing user enquiries to customer service people, all via WhatsApp

## Prerequisites

* A Nexmo account, [sign up for a new account here](https://dashboard.nexmo.com/sign-up?utm_source=DEV_REL&utm_medium=github&utm_campaign=text-based-whatsapp-callcenter) if you don't have one already
* **EITHER** a WhatsApp Business number **OR** you can try this app using the [Messages API Sandbox](https://developer.nexmo.com/messages/concepts/messages-api-sandbox) - but only telephone numbers that you whitelist through the dashboard can be used. This makes the sandbox ideal for testing with a controlled group of numbers.
* NodeJS and NPM
* Redis

## Set up the application to run locally

1. Create a messages application and set the incoming message and message status webhooks to point to `[APP URL]/webhooks/inbound` and `[APP URL]/webhooks/status` respectively. See also: [Creating a Messages API Application](https://developer.nexmo.com/messages/code-snippets/create-an-application)
2. If you are using the Messages Sandbox, then also configure the sandbox URLs for Messages to point to (the same URLs as used in the application) `[APP URL]/webhooks/inbound` and `[APP_URL]/webhooks/status` respectively.
  - Your application must be publicly available. If running locally, you might find our [guide to using Ngrok for development](https://developer.nexmo.com/tools/ngrok) helpful.
3. Clone this repo, and run `npm install`
4. Copy the `.env.example` file to `.env`
5. Add your configuration values to the `.env` file, this will include the connection details for your Redis instance and your Nexmo credentials including an application and private key. The private key should be pasted on one line with all newlines replaced with `\n`
6. Run `npm start` in your terminal

## Set up the application on Heroku

1. Create a Heroku Application, and deploy the contents of this repo to it.
2. Add the "Heroku Redis" add-on (the hobby level is fine for testing)
3. Create a messages application and set the incoming message and message status webhooks to point to `[APP URL]/webhooks/inbound` and `[APP URL]/webhooks/status` respectively. See also: [Creating a Messages API Application](https://developer.nexmo.com/messages/code-snippets/create-an-application)
4. If you are using the Messages Sandbox, then also configure the sandbox URLs for Messages to point to (the same URLs as used in the application) `[APP URL]/webhooks/inbound` and `[APP_URL]/webhooks/status` respectively.
5. Back on Heroku, under "Settings" set the "Config vars". These will be as named in the `.env.example` file:
 * Your Nexmo credentials and application information
 * Note that the private key should be a string with `\n` for newlines
 * No need to set the `REDIS_URL` for Heroku, the add-on does that for you

## Using the app

> Note that all participants must first whitelist their numbers with the Messages Sandbox. You can [find more information about the Messages Sanbox on the Developer Portal](https://developer.nexmo.com/messages/concepts/messages-api-sandbox)

* Your agent numbers can send the message "sign in" to the WhatsApp number, the WhatsApp number will respond back that they have signed in.
* Your customer numbers will then message the same number with their questions or requests.
* Customer messages will be forwarded to the appropriate agent with an emoji prepended to the message. This feature allows the agent to handle multiple conversations simultaneously in a single whatsapp conversation.
* Agents respond to the WhatsApp conversation, with the appropriate emoji at the beginning of their message and the message will be routed to the correct cuser
* If the Agent sends a "sign out" message, their customers will be reallocated to available agents. If there are no available agents then the customer will be notified that there are no available agents.

## Getting Help

We love to hear from you so if you have questions, comments or find a bug in the project, let us know! You can either:

* Open an issue on this repository
* Tweet at us! We're [@VonageDev on Twitter](https://twitter.com/VonageDev)
* Or [join the Vonage Community Slack](https://developer.nexmo.com/community/slack)

## Further Reading

* Check out the Developer Documentation at <https://developer.nexmo.com>
* More information about the Messages API Sandbox: <https://developer.nexmo.com/messages/concepts/messages-api-sandbox>

