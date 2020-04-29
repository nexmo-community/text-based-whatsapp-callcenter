const express = require('express')
const bodyParser = require('body-parser')
const Nexmo = require('nexmo')
const path = require('path')
const redis = require('redis')
require('dotenv').config();
const PORT = process.env.PORT || 5000
const redisClient = redis.createClient(process.env.REDIS_URL);
const nexmo = new Nexmo({
  apiKey: process.env.NEXMO_API_KEY,
  apiSecret: process.env.NEXMO_API_SECRET,
  applicationId: process.env.NEXMO_APPLICATION_ID,
  privateKey: Buffer.from(process.env.NEXMO_APPLICATION_PRIVATE_KEY.replace(/\\n/g, "\n"), 'utf-8')
},{
  apiHost:'messages-sandbox.nexmo.com'
}
);
const agentNum = process.env.AGENT_NUM
const agentNum2 = process.env.AGENT_NUM2

const CUSTOMERS = '_customers';
// for the moment agent's must be pre-seeded
if(agentNum)
{
  redisClient.hmset(agentNum, 'name', "fred", "type","agent", "availability", "unavailable")
}
if (agentNum2){
  redisClient.hmset(agentNum2, 'name', "sam", "type","agent", "availability", "unavailable")
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
      if(!user || (!user['agentNum'] && user['type'] == 'customer')){        
        redisClient.spop('available',(err,reply)=>{
          if(err){
            console.log(err)
          }
          if(reply){
            var charPoint = parseInt(reply.codePointAt(reply.length-2).toString('16'),16)
            agentNumber = reply.substring(0,reply.length-2)
            var emoji = String.fromCodePoint(charPoint)  
            
            redisClient.hmset(fromNumber, "proxyNumber", toNumber, "channel", channel, 'agent', reply, 'type', 'customer', 'emoji', emoji, 'agentNum', agentNumber);
            redisClient.sadd(agentNumber+CUSTOMERS,fromNumber);
            handleInboundFromCustomer(agentNumber, body, emoji);
            redisClient.set(reply, fromNumber);
          }
          else{
            let message = {type:"text", text:"We're sorry, no agent's are available at this time. Please try again later"};
            sendWhatsAppMessage(toNumber, fromNumber, message);          
          }
        })        
      }
      else{
        if(user['type'] == 'customer'){
          
          handleInboundFromCustomer(user['agentNum'], body, user['emoji'])
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
  sendWhatsAppMessage(fromNumber, agentNumber, messageBody['message']['content'])
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
          sendWhatsAppMessage(messageBody['to']['number'], number, messageBody['message']['content'])
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
already signed in, if not it set's agent's status to available and 
*/
function handleSignIn(agentNumber, from){
  let message = {"type":"text","text":"something went wrong while signing you in"}
  redisClient.hgetall(agentNumber,(err,reply)=>{
    if (err){
      console.log(err)      
    }
    else{
      if(!reply || reply['availability'] == 'unavailable'){
        emojis.forEach((entry)=>{
          redisClient.sadd('available',agentNumber+entry)
        });
        redisClient.hset(agentNumber, "availability","available");
        message = {"type":"text","text":"You have been signed in"}
      }
      else{
        message = {"type":"text","text":"You were already signed in"}
      }
    }
    sendWhatsAppMessage(from,agentNumber,message);
  })
}

function handleSignOut(agentNumber, from){
  emojis.forEach((entry)=>{
    redisClient.srem('available',1,agentNumber+entry);
  });
  redisClient.hset(agentNumber, "availability", "unavailable")

  redisClient.smembers(agentNumber+CUSTOMERS, (err,reply)=>{
    if (err){
      console.log(err)
    }
    else{      
      reply.forEach((entry)=>{
        reassignAgent(entry)
      })
      redisClient.del(agentNumber+CUSTOMERS)
    }
  })

  message = {"type":"text","text":"You have been signed out"}
  sendWhatsAppMessage(from,agentNumber,message);
}

function reassignAgent(customerNumber){
  redisClient.spop('available',(err,reply)=>{
    if(err){
      console.log(err)
    }
    else if(reply){
      var charPoint = parseInt(reply.codePointAt(reply.length-2).toString('16'),16)
      agentNumber = reply.substring(0,reply.length-2)
      var emoji = String.fromCodePoint(charPoint)
      redisClient.hmset(customerNumber, 'agent', reply, 'emoji', emoji, 'agentNum', agentNumber);
      redisClient.sadd(agentNumber+CUSTOMERS,customerNumber);
      redisClient.set(reply, customerNumber);
      redisClient.hgetall(customerNumber, (err,user)=>{
        if(err){
          console.log(err)
        }
        else{
          proxyNumber = user['proxyNumber']
          let body = {"type":"text", "text":emoji+" - You have been assigned a new case"};
          sendWhatsAppMessage(proxyNumber, agentNumber, body);
        }      
      })
    }
    else{
      redisClient.hmset(customerNumber, 'agent', '', 'emoji', '', 'agentNum', '');
      let body = {"type":"text", "text":"We're sorry, there are no available agents at this time, please try again later"};
      redisClient.hgetall(customerNumber, (err,user)=>{
        if(err){
          console.log(err)
        }
        else{
          proxyNumber = user['proxyNumber']          
          sendWhatsAppMessage(proxyNumber, customerNumber, body);
        }      
      })
    }    
  })
}

function sendWhatsAppMessage(from, to, message){  
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