
const colors = ["#272838","#F3DE8A","#050609","#404E7C","#582707","#750D37","#332E3C","#861657","#412722","#0B0014","#32965D","#DF2935"]


function onLoad(){

    element_html = document.getElementsByTagName("html").item(0)
    element_body = document.getElementsByTagName("body").item(0)

    let random = Math.floor(Math.random()*colors.length)

    element_html.style.backgroundColor = colors[random];
    element_body.style.backgroundColor = colors[random];

    element_html.style.transition = "1s ease";
    element_body.style.transition = "1s ease";


}

window.onload = onLoad
