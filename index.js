const express = require('express')
const bodyParser = require('body-parser')
const Nexmo = require('nexmo')
const path = require('path')
const redis = require('redis')
require('dotenv').config();
const PORT = process.env.PORT || 5000
const redisClient = redis.createClient();
const pk = Buffer.from(process.env.NEXMO_APPLICATION_PRIVATE_KEY.replace(/\\n/g,"\n"),'utf-8')
const nexmo = new Nexmo({
  apiKey: process.env.NEXMO_API_KEY,
  apiSecret: process.env.NEXMO_API_SECRET,
  applicationId: process.env.NEXMO_APPLICATION_ID,
  privateKey: pk
},{
  apiHost:'messages-sandbox.nexmo.com'
}
);
const agentNum = process.env.AGENT_NUM
// for the moment agent's must be pre-seeded
if(agentNum)
{
  redisClient.hmset(agentNum, 'name', "fred", "type","agent", "availability", "unavailable")
}

const emojis = ['🏠','🍎','🥑']

const app = express()

app.use(express.static(path.join(__dirname, 'public')))
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({extended:true}))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  
app
  .route('/webhooks/inbound')
  .get(handleInbound)
  .post(handleInbound);

app
  .route('/webhooks/status')
  .get(handleStatus)
  .post(handleStatus);

/**
 * This looks to see if there is already a user record for the from number
 * if not - create a new Customer user object (consequentially agent's must be pre-seeded)
 * if a user exists for that number check if it's a customer or agent and handle appropriately
 * @param {http request from the webhook} request 
 * @param {response to be sent back to the webhook} response 
 */
function handleInbound(request, response) {
  var body = request.body
  let fromNumber = body['from']['number']
  let toNumber = body['to']['number']
  let channel = body['to']['type']
  redisClient.hgetall(fromNumber, (err,user)=>{
    if(err){
      console.log(err)
    }
    else{      
      if(!user){        
        redisClient.lpop("available",(err,reply)=>{
          if(err){
            console.log(err)
          }
          if(reply){
            var charPoint = parseInt(reply.codePointAt(reply.length-2).toString('16'),16)
            var emoji = String.fromCodePoint(charPoint)  
            
            redisClient.hmset(fromNumber, "proxyNumber", toNumber, "channel", channel, 'agent', reply, 'type', 'customer', 'emoji', emoji);
            handleInboundFromCustomer(agentNum, body, emoji);
            redisClient.set(reply, fromNumber);
          }
        })        
      }
      else{
        if(user['type'] == 'customer'){
          handleInboundFromCustomer(agentNum, body, user['emoji'])
        }
        else{
          handleInboundFromAgent(body)
        }
      }      
    }
  }) 
  const params = Object.assign(request.query, request.body)
  console.log(params)
  response.status(204).send()
};

/**
 * prepends '<emoji> - ' to the text of the message's content, then forwards that message onto the user
 * @param {number of the agent handling the customer} agentNumber string
 * @param {json payload of the message} messageBody object
 * @param {the emoji being used for this customer} emoji 
 */
function handleInboundFromCustomer(agentNumber, messageBody, emoji){
  let fromNumber = messageBody['to']['number']
  messageBody['message']['content']['text'] = emoji + " - " + messageBody['message']['content']['text']
  sendWhatsappMessage(fromNumber, agentNumber, messageBody['message']['content'])
}

/**
 * this handles inbound messages from agent's
 * it assumes that the message will be in the format 
 *  1:'<emoji> - message'
 *  2:'sign in'
 *  3:'sign out'
 * if it's a sign in, it executes the signIn method, same with sign out
 * otherwise it grabs the first character (assumed to be a utf-32 emoji)
 * appends that emoji to the end of the agent's name and uses that composite as the hash
 * for redis, using all of this it then forwards on the message to the desired number
 * @param {this is the body from the inbound whatsApp message} messageBody  
 */
function handleInboundFromAgent(messageBody){
  let msgText = messageBody['message']['content']['text'];
  if(msgText.toLowerCase().indexOf("sign in")>=0){
    handleSignIn(messageBody['from']['number'], messageBody['to']['number']);
  }
  else if (msgText.toLowerCase().indexOf("sign out") >= 0){
    handleSignOut(messageBody['from']['number'], messageBody['to']['number']);
  }
  else{
    var charPoint = parseInt(msgText.codePointAt(0).toString('16'),16)
    var emoji = String.fromCodePoint(charPoint)    
    messageBody['message']['content']['text'] = messageBody['message']['content']['text'].substring(4);
    redisClient.get(messageBody['from']['number']+emoji, (err,number)=>{
      if(err){
        console.log(err);
      }
      else{
        if(number){
          sendWhatsappMessage(messageBody['to']['number'], number, messageBody['message']['content'])
        }
        else{
          console.log('number not found for ' + emoji)
        }      
      }
    })
  }  
}

/*
Checks if agent is already available, if you they are, then it tells you the agent they've 
already signed in, if not it set's agent's status to 'available' and 
*/
function handleSignIn(agentNumber, from){
  let message = {"type":"text","text":"something went wrong while signing you in"}
  redisClient.hgetall(agentNum,(err,reply)=>{
    if (err){
      console.log(err)      
    }
    else{
      if(!reply || reply['availability'] == 'unavailable'){
        emojis.forEach((entry)=>{
          redisClient.lpush('available',agentNum+entry)
        });
        redisClient.hset(agentNum, "availability","available");
        message = {"type":"text","text":"You have been signed in"}
      }
      else{
        message = {"type":"text","text":"You were already signed in"}
      }
    }
    sendWhatsappMessage(from,agentNum,message);
  })
}

function handleSignOut(agentNumber, from){
  emojis.forEach((entry)=>{
    redisClient.lrem('available',1,agentNum+entry);
  });
  redisClient.hset(agentNum, "availability", "unavailable")
  message = {"type":"text","text":"You have been signed out"}
  sendWhatsappMessage(from,agentNum,message);
}


function sendWhatsappMessage(from, to, message){  
  nexmo.channel.send(
    { "type": "whatsapp", "number": to },
    { "type": "whatsapp", "number": from },
    {
      "content": message
    },
    (err, data) => {
      if (err) {
        console.error(err);
      } else {
        console.log(data.message_uuid);
      }
    }
  );
}

function handleStatus(request, response){
  const params = Object.assign(request.query, request.body)
  console.log(params)
  response.status(204).send()
}
app.listen(PORT, () => console.log(`Listening on ${ PORT }`))