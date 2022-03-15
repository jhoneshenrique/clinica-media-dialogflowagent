// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';

//1. Require Firebase Functions
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');

//2. Require Firebase admin, setting up and authenticate (otherwise firestore doesn't let in)
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
admin.firestore().settings({timestampsInSnapshots:true});
const firestoreDB = admin.firestore();
const authService = admin.auth();
 
process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements
 
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
 
  //Função welcome
  function welcome(agent) {
    agent.add(`Welcome to my agent!`);
  }
 
  //Função de Fallback
  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }
  
  //3. Booking appointment function
  function agendar(agent) {
      let especialidade = agent.parameters.especialidade;
      let dataconsulta = agent.parameters.dataconsulta;
      let emailpaciente = agent.parameters.emailpaciente;
      let nomepaciente = agent.parameters.nomepaciente;
      let horarioconsulta = agent.parameters.horarioconsulta;
      
      // Get the database collection 'dialogflow' and document 'agent' and store
      const dialogflowAgentRef = firestoreDB.collection('consultas').doc(emailpaciente);
      return firestoreDB.runTransaction(t => {
        t.set(dialogflowAgentRef, {especialidade: especialidade,
              dataconsulta: dataconsulta,
              emailpaciente: emailpaciente,
              nomepaciente: nomepaciente,
              horarioconsulta: horarioconsulta});
      return Promise.resolve('Write complete');
      }).then(doc => {
        agent.add(`Consulta marcada com sucesso`);
      }).catch(err => {
         // console.log(`Error writing to Firestore: ${err}`);
        agent.add(`Falha ao gravar no banco`);
     });
      
  }
  
  //4. Consult the date of the appointment
  function buscar_consulta(agent) {
    let emailpaciente = agent.parameters.emailpaciente;
    // Get the database collection 'dialogflow' and document 'agent'
    const dialogflowAgentDoc = firestoreDB.collection('consultas').doc(emailpaciente);

    // Get the value of 'entry' in the document and send it to the user
    return dialogflowAgentDoc.get()
      .then(doc => {
        if (!doc.exists) {
          agent.add('No data found in the database!');
        } else {
          let d = new Date(doc.data().dataconsulta);
          let data = d.getDate()+"/"+(d.getMonth()+1)+"/"+d.getFullYear();
          let hora = d.getHours();
          let minuto = d.getMinutes()==0?'00':d.getMinutes();
          agent.add('Sua consulta está marcada para '+data+' ás '+hora+":"+minuto);
        }
        return Promise.resolve('Read complete');
      }).catch(() => {
        agent.add('Error reading entry from the Firestore database.');
        agent.add('Please add a entry to the database first by saying, "Write <your phrase> to the database"');
      }); 
  }

  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('agendamento.consulta', agendar);
  intentMap.set('buscar.consulta',buscar_consulta);
  
  // intentMap.set('your intent name here', yourFunctionHandler);
  // intentMap.set('your intent name here', googleAssistantHandler);
  agent.handleRequest(intentMap);
});
