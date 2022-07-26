let config = {
  enableLightning: 1,
  cloudTexPath: "../res/cloud01.png",
  rainCount: 0 ,
  rainMax: 10000 ,
  light: 0xffeedd ,
  twilight: 0xffffff ,
  debug: false,
  isAndroid: /android/i.test( navigator.userAgent || navigator.vendor || window.opera ),
  openWeatherMapApiKey: '<api_key>'
}

let camera, scene, renderer;
let geo = new Geo(config.openWeatherMapApiKey);

var sunInterval;

renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.setClearColor(0x000e24,1.0);
document.body.appendChild(renderer.domElement);

scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(config.light, 0.002);
camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  1,
  20000
);
camera.rotation.x = 0.47;

const pmremGenerator = new THREE.PMREMGenerator(renderer);

const stars = new Starfield( 10000, 200, 0.02 );
scene.add(stars);
stars.renderOrder = -99;

const sky = new Sky();
sky.scale.setScalar(10000);
scene.add(sky);
sky.renderOrder = -98;

// Ambient Light
ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

// Directional Light
directionalLight = new THREE.DirectionalLight(config.light);
directionalLight.position.set(0,0,1);
scene.add(directionalLight);

// Point Light
flash = new LighteningBolt(scene, 5);

sunset = new THREE.PointLight(config.twilight, 1, 0, 2);
sunset.position.set(1, 1, 0);
scene.add(sunset);

clouds = new CloudField(scene, 20);

// Rain Drop Texture
rain = new Rainfield(500);
rain.visible = false;
scene.add(rain);

updateSunInterval();

if (navigator.geolocation){
  updateLocation();
  setInterval(updateLocation, 15000);    
}

render();

function render() {

  renderer.render(scene, camera);
  requestAnimationFrame(render);

  stars.render();
  clouds.render();
  rain.render();
  flash.render();
}

if (window.android){
  setCameraOffsetAndroid();
}


function updateSunInterval(){
  clearInterval(sunInterval);
  refresh();
  sunInterval = setInterval(updateSunInterval, geo.sun.timeout);
}

function updateLocation() {
  geo.update(() => refresh());
}

var stepUpdate = 0;

function refresh(){
  
  var p;
  if (window.android && 
    window.android.getValue && 
    (p = window.android.getValue("solarPos")) === -101){
      geo.sun.update();
  }
  sky.config(geo.sun.elevation, geo.sun.azimuth, geo.weather.clouds, geo.weather.hum);
  scene.environment = pmremGenerator.fromScene(sky).texture;

  if (geo.sun.timeout > 4000 || stepUpdate % 4 == 0){
    geo.lerp();
    renderer.toneMappingExposure = 0.5 + geo.light.twilight;
    config.rainCount = geo.weather.rain / 8 * config.rainMax;
    flash.flash.isEnabled = config.rainCount > 0.8 * config.rainMax;
    scene.fog.color.setHSL(0.147, 0.05, 0.3 + 0.7 * geo.light.twilight);
    directionalLight.color.setHSL(0.147, 0, geo.light.twilight);
    ambient.color.setHSL(0.147, 0.05, 0.3 + 0.7 * geo.light.twilight);
    sunset.color.copy(geo.light.sundisk);
    stars.material.opacity = 1 - geo.light.twilight;
    clouds.apply(geo);
    rain.visible = config.rainCount > 0
    
    stepUpdate++;

  }
}

function setCameraOffset(offset){
  camera.position.x = offset;
}

function setCameraOffsetAndroid(){
  //camera.position.x = android.getXOffset() * window.innerWidth * 0.5;
  camera.rotation.y = -android.getXOffset() * Math.PI / 6;
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});