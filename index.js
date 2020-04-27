const express = require('express')
const bodyParser = require('body-parser')
const Nexmo = require('nexmo')
const path = require('path')
const redis = require('redis')
require('dotenv').config();
const PORT = process.env.PORT || 5000
const redisClient = redis.createClient();

const nexmo = new Nexmo({
  apiKey: process.env.NEXMO_API_KEY,
  apiSecret: process.env.NEXMO_API_SECRET,
  applicationId: process.env.NEXMO_APPLICATION_ID,
  privateKey: process.env.NEXMO_APPLICATION_PRIVATE_KEY
},{
  apiHost:'messages-sandbox.nexmo.com'
}
);
const agentNum = process.env.AGENT_NUM
redisClient.hmset(agentNum, 'name', "fred", "type","agent")
const emojis = ['🏠','🍎','🥑']
emojis.forEach(function(entry){
  redisClient.get(entry,(err,reply)=>{
    if(err){
      console.log(err)
    }
    else{
      if(!reply){
        redisClient.lpush('emojis',entry);
      }
    }
  })  
})

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
        redisClient.lpop("emojis",(err,reply)=>{
          if(err){
            console.log(err)
          }
          if(reply){
            redisClient.hmset(fromNumber, "proxyNumber", toNumber, "channel", channel, 'agent', agentNum, 'type', 'customer', 'emoji', reply);
            handleInboundFromCustomer(agentNum, body, reply);
            redisClient.set(reply, fromNumber);
          }
        })        
      }
      else{
        if(user['type'] == 'customer'){
          handleInboundFromCustomer(agentNum, body, user['emoji'])
        }
        else{
          handleInboundFromAgent(body, user)
        }
      }      
    }
  }) 
  const params = Object.assign(request.query, request.body)
  console.log(params)
  response.status(204).send()
};

function handleInboundFromCustomer(agentNumber, messageBody, emoji){
  let fromNumber = messageBody['to']['number']
  messageBody['message']['content']['text'] = emoji + " - " + messageBody['message']['content']['text']
  sendWhatsappMessage(fromNumber, agentNumber, messageBody['message']['content'])
}

function handleInboundFromAgent(messageBody, user){
  var emojiLeadingSurrogate = messageBody['message']['content']['text'].charCodeAt(0).toString('16')
  var emojiTrailingSurrogate = messageBody['message']['content']['text'].charCodeAt(1).toString('16')  
  var emoji = String.fromCharCode(parseInt(emojiLeadingSurrogate,16),parseInt(emojiTrailingSurrogate,16));
  messageBody['message']['content']['text'] = messageBody['message']['content']['text'].substring(4);
  redisClient.get(emoji, (err,number)=>{
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