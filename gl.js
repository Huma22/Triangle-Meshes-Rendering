import buildingShaderSrc from './building.vert.js';
import flatShaderSrc from './flat.vert.js';
import fragmentShaderSrc from './fragment.glsl.js';

var gl;

var layers = null

var modelMatrix;
var projectionMatrix;
var viewMatrix;


var currRotate = 0;
var currZoom = 0;
var currProj = 'perspective';

/*
    Vertex shader with normals
*/
class BuildingProgram {

    constructor() {
        this.vertexShader = createShader(gl, gl.VERTEX_SHADER, buildingShaderSrc);
        this.fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSrc);
        this.program = createProgram(gl, this.vertexShader, this.fragmentShader);
        this.posAttribLoc = gl.getAttribLocation(this.program, "position");
        this.normAttribLoc = gl.getAttribLocation(this.program, "normal");
        this.modelLoc = gl.getUniformLocation(this.program, 'uModel');
        this.projLoc = gl.getUniformLocation(this.program, 'uProjection');
        this.viewLoc = gl.getUniformLocation(this.program, 'uView');
        this.colorLoc = gl.getUniformLocation(this.program, 'uColor');
    }

    use() {
        gl.useProgram(this.program);
    }
}

/*
    Vertex shader with uniform colors
*/
class FlatProgram {

    constructor() {
        this.vertexShader = createShader(gl, gl.VERTEX_SHADER, flatShaderSrc);
        this.fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSrc);
        this.program = createProgram(gl, this.vertexShader, this.fragmentShader);
        this.posAttribLoc = gl.getAttribLocation(this.program, "position");
        this.modelLoc = gl.getUniformLocation(this.program, 'uModel');
        this.projLoc = gl.getUniformLocation(this.program, 'uProjection');
        this.viewLoc = gl.getUniformLocation(this.program, 'uView');
        this.colorLoc = gl.getUniformLocation(this.program, 'uColor');
    }

    use() {
        gl.useProgram(this.program);
    }
}


/*
    Collection of layers
*/
class Layers {
    constructor() {
        this.layers = {};
        this.centroid = [0,0,0];
    }

    addBuildingLayer(name, vertices, indices, normals, color){
        var layer = new BuildingLayer(vertices, indices, normals, color);
        layer.init();
        this.layers[name] = layer;
        this.centroid = this.getCentroid();
    }

    addLayer(name, vertices, indices, color) {
        var layer = new Layer(vertices, indices, color);
        layer.init();
        this.layers[name] = layer;
        this.centroid = this.getCentroid();
    }

    removeLayer(name) {
        delete this.layers[name];
    }

    draw() {
        for(var layer in this.layers) {
            this.layers[layer].draw(this.centroid);
        }
    }

    
    getCentroid() {
        var sum = [0,0,0];
        var numpts = 0;
        for(var layer in this.layers) {
            numpts += this.layers[layer].vertices.length/3;
            for(var i=0; i<this.layers[layer].vertices.length; i+=3) {
                var x = this.layers[layer].vertices[i];
                var y = this.layers[layer].vertices[i+1];
                var z = this.layers[layer].vertices[i+2];
    
                sum[0]+=x;
                sum[1]+=y;
                sum[2]+=z;
            }
        }
        return [sum[0]/numpts,sum[1]/numpts,sum[2]/numpts];
    }
}

/*
    Layers without normals (water, parks, surface)
*/
class Layer {
    constructor(vertices, indices, color) {
        this.vertices = vertices;
        this.indices = indices;
        this.color = color;
    }

    init() {
        this.program = new FlatProgram();
        this.indexBuff = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.indices));
        this.vertexBuff = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(this.vertices));
        
        this.vao = createVAO(gl, this.program.posAttribLoc, this.vertexBuff);
    }

    draw(centroid) {
        
        this.program.use();

        updateModelMatrix(centroid);
        gl.uniformMatrix4fv(this.program.modelLoc, false, new Float32Array(modelMatrix));   
        updateProjectionMatrix();
        gl.uniformMatrix4fv(this.program.projLoc, false, new Float32Array(projectionMatrix));  
        updateViewMatrix(centroid);
        gl.uniformMatrix4fv(this.program.viewLoc, false, new Float32Array(viewMatrix));
        gl.uniform4fv(this.program.colorLoc, this.color);
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuff);

        gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_INT, 0);
        
    }
}

/*
    Layer with normals (building)
*/
class  BuildingLayer extends Layer {
    constructor(vertices, indices, normals, color) {
        super(vertices, indices, color);
        this.normals = normals;
    }

    init() { 
        this.program  = new BuildingProgram();

        this.indexBuff = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.indices));
        this.normalBuff = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(this.normals));
        this.vertexBuff = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(this.vertices));

        this.vao = createVAO(gl, this.program.posAttribLoc, this.vertexBuff, this.program.normAttribLoc, this.normalBuff );
    }

    draw(centroid) {
        this.program.use();

        updateModelMatrix(centroid);
        gl.uniformMatrix4fv(this.program.modelLoc, false, new Float32Array(modelMatrix));
        updateProjectionMatrix();
        gl.uniformMatrix4fv(this.program.projLoc, false, new Float32Array(projectionMatrix));
        updateViewMatrix(centroid);
        gl.uniformMatrix4fv(this.program.viewLoc, false, new Float32Array(viewMatrix)); 
        gl.uniform4fv(this.program.colorLoc, this.color);
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuff);

        gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_INT, 0);
    }
}

/*
    Event handlers
*/
window.updateRotate = function() {
    currRotate = parseInt(document.querySelector("#rotate").value);
}

window.updateZoom = function() {
    currZoom = parseFloat(document.querySelector("#zoom").value);
}

window.updateProjection = function() {
    currProj = document.querySelector("#projection").value;
}

/*
    File handler
*/

window.handleFile = function(e) {
    var reader = new FileReader();
    reader.onload = function(evt) {
        var parsed = JSON.parse(evt.target.result);
        for(var layer in parsed){
            var aux = parsed[layer];
            switch (layer) {
                // TODO: add to layers
                case 'buildings':
                    layers.addBuildingLayer('buildings', aux['coordinates'], aux['indices'], aux['normals'], aux['color']);
                    break;
                case 'water':
                    layers.addLayer('water', aux['coordinates'], aux['indices'],  aux['color']);
                    break;
                case 'parks':
                    layers.addLayer('parks', aux['coordinates'], aux['indices'],  aux['color']);
                    break;
                case 'surface':
                    layers.addLayer('surface', aux['coordinates'], aux['indices'],  aux['color']);
                    break;
                default:
                    break;
            }
        }
    }
    reader.readAsText(e.files[0]);
}
/*
    Update transformation matrices
*/
function updateModelMatrix(centroid) {
    
    var pos1 = translateMatrix(-centroid[0], -centroid[1], -centroid[2]);
    var pos2 = translateMatrix(centroid[0], centroid[1], centroid[2]);

    var rotate = rotateZMatrix(currRotate*Math.PI/180.0);
    modelMatrix = multiplyArrayOfMatrices([
        pos2, rotate, pos1
    ])
}

function updateProjectionMatrix() {
    var aspect = window.innerWidth / window.innerHeight;
    if (currProj == 'perspective'){
        projectionMatrix = perspectiveMatrix(45.0 * Math.PI / 180.0, aspect, 1, 50000);
    }else{
        var maxZoom = 5000;
        var zoom = maxZoom - (currZoom/100)*maxZoom*0.99;
        projectionMatrix = orthographicMatrix(-aspect*zoom, aspect*zoom, -zoom, zoom, -1, 50000);
    }
    
}

function updateViewMatrix(centroid) {
    var maxZoom = 5000;
    var zoom = maxZoom - (currZoom/100.0)*maxZoom*0.99;
    viewMatrix = lookAt(add(centroid, [zoom, zoom, zoom]), centroid, [0, 0, 1]);
}

/*
    Main draw function (should call layers.draw)
*/
function draw() {

    gl.clearColor(190/255, 210/255, 215/255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    layers.draw();

    requestAnimationFrame(draw);

}
/*
    Initialize everything
*/
function initialize() {

    var canvas = document.querySelector("#glcanvas");
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    gl = canvas.getContext("webgl2");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);

    layers = new Layers();

    window.requestAnimationFrame(draw);

}


window.onload = initialize;