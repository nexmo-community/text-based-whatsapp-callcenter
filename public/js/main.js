$.get('/getAgents', function(data){
    data.forEach(element => {
      var rowHtml = "<tr><td>"+element['name']+"</td><td>"+element['number']+"</td><td>"+element['availability']+"</td></tr>";
      $("table tbody").append(rowHtml);
    });    
})