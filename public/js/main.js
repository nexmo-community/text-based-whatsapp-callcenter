// Elements
const addAgentButton = document.getElementById('addAgentButton');
const agentNumberField = document.getElementById('agentNum');
const agentNameField = document.getElementById('agentName');
const errorField = document.getElementsByClassName('error');

// Hide error notice on load
$('.error').hide();

// Ensure that the Agent fields are not empty
addAgentButton.addEventListener('click', (e) => {
  if (agentNameField.value == '') {
    e.preventDefault();
    console.log('blank');
  }
});

$.get('/getAgents', function (data) {
  data.forEach((element) => {
    var rowHtml =
      '<tr><td>' +
      element['name'] +
      '</td><td>' +
      element['number'] +
      '</td><td>' +
      element['availability'] +
      '</td></tr>';
    $('#agentTable tbody').append(rowHtml);
  });
});
$.get('/getCustomers', function (data) {
  data.forEach((element) => {
    var rowHtml =
      '<tr><td>' +
      element['assignedAgentNum'] +
      '</td><td>' +
      element['customerNumber'] +
      '</td><td>' +
      element['emoji'] +
      '</td></tr>';
    $('#customersTable tbody').append(rowHtml);
  });
});
