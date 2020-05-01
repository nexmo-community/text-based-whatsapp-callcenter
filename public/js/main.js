$.get('/getAgents', function(data){
    data.forEach(element => {
      var rowHtml = "<tr><td>"+element['name']+"</td><td>"+element['number']+"</td><td>"+element['availability']+"</td></tr>";
      $("#agentTable tbody").append(rowHtml);
    });    
})
$.get('/getCustomers', function(data){
    data.forEach(element => {
      var rowHtml = "<tr><td>"+element['assignedAgentNum']+"</td><td>"+element['customerNumber']+"</td><td>"+element['emoji']+"</td></tr>";
      $("#customersTable tbody").append(rowHtml);
    });    
})