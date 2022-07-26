const debug = true;

const sprintf = (str, ...argv) => !argv.length ? str : sprintf(str = str.replace("%"||"$", argv.shift()), ...argv);
const dlog = (str,...argv) => {if (debug) console.log(sprintf(str,...argv))};
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const norm = (x) => clamp(x, 0, 1);
const deg2norm = (deg) => ((deg + 360) % 360) / 360;
const atan_n = (x, midpoint, smooth) => 0.5 + Math.atan(smooth * (x - midpoint))/Math.PI;
const inv2 = (x, k) => 1 / (k * x * x + 1);
const inv2d = (x, k, d) => inv2(x + d, k);
const nrand = (amplitude, center) => Math.random() * amplitude - (amplitude-center);
const prand = (min,max) => min + (max - min) * Math.random();
const norm_exp01 = ( x, min, max, k ) => norm(min + (max-min) * Math.exp(k * x - k));

function Geo(apiKey){

    this.apiKey = apiKey;

    this.location = {

        latitude: 0,
        longitude: 0,
        timestamp: 0,
        timeout: 3600000,
        
        update: function(callback){
            navigator.geolocation.getCurrentPosition(p => {
                this.latitude = p.coords.latitude;
                this.longitude = p.coords.longitude;
                this.timestamp = new Date().getTime();
                callback();
            });
        },
        
        save: function(){
            if (window.localStorage)
                window.localStorage.setItem("geo.location",JSON.stringify(this));
        },
        
        load: function(){
            if (window.localStorage)
                arguments.callee = JSON.parse(window.localStorage.getItem("geo.location"));
        },

        toString: function(){
            return JSON.stringify(this);
        }
    }

    this.sun = {
        elevation: 0,
        azimuth: 0,
        maxTimeout: 60000,
        minTimeout: 1000,
        timeout: 6000,

        update: function(date, latitude, longitude){
            const s = SunCalc.getPosition(date, latitude, longitude);
            this.elevation = s.altitude;
            this.azimuth = s.azimuth;
            const tw = inv2d(this.elevation, 0.06, 216);
            this.timeout = Math.round(this.minTimeout + (this.maxTimeout - this.minTimeout) * (1 - tw));
        },

        getSun: function(){
            const sun = new THREE.Vector3();
            const phi = Math.PI/2 - this.elevation;
            const theta = this.azimuth + Math.PI / 3; //s.azimuth; //THREE.MathUtils.degToRad(parameters.azimuth);
            //const theta = this.azimuth;
            sun.setFromSphericalCoords(1, phi, theta);
            return sun;
        }
    }

    this.light = {

      moonlight: 0,
      twilight: 1,
      twc: 0,
      intensity: 0,
      sundisk: new THREE.Color(0xfffefd),
      fog: new THREE.Color(0xfffefd),
      nightColor: new THREE.Color(0x000e24),

      update: function(sunElev, weather){
        this.twilight = atan_n(sunElev,  0.018, 72);
        this.intensity = atan_n(sunElev, -0.018, 72);
        const s1 = atan_n(sunElev, -0.06, 72);
        const l0 = 1 - atan_n(weather.clouds * 0.5 + weather.rain * 0.25, 0.53, 42);
        const tw = l0 / (sunElev * sunElev * 72 + 1);
        const tw2 = inv2d(sunElev, 0 , 2160);
        const lum = s1 * 0.5 + 0.12 + ( this.moonlight / 32 + 0.17 ) * l0;
        this.sundisk.setHSL( 0.174 * s1, 0.0 * tw, 0.1 + 0.9 * this.twilight * (1.0 - weather.clouds));
        this.fog.setHSL(0.174 * this.intensity, 0.0 * tw2 * this.twilight, this.twilight * lum * 0.72 + 0.28);
        console.log("light intens:",this.intensity," twilight:", this.twilight);
      },

      setMoonlight: function(date){
        this.moonlight = SunCalc.getMoonIllumination(date).fraction;
        this.nightColor.setHSL(0.6,1,0.07 + 0.07 * this.moonlight);
      }
    }

    this.date = new Date();

    this.forecast = {
        
        jsonData: JSON.parse("{}"),
        timestamp: 0,
        latitude: 0,
        longitude: 0,
        thresholdKm: 50,
        timeout: 1 * 86400000,

        update: function(loc, key, callback){
            const out = (data) => {
                if ('list' in data){
                    this.jsonData = data.list.sort((a,b) => a.dt - b.dt);
                    this.timestamp = new Date().getTime();
                    this.latitude = loc.latitude;
                    this.longitude = loc.longitude;
                    this.save();
                }
                callback();
            }
            const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${loc.latitude}&lon=${loc.longitude}&APPID=${key}`;
            
            dlog("requesting weather data: %",url);
            fetch(url)
                .then(response => response.json())
                .then(data => out(data));
        },

        save: function(){
            if (window.localStorage)
                window.localStorage.setItem("geo.forecast",JSON.stringify(this));
        },

        load: function(){
            if (window.localStorage)
                arguments.callee = JSON.parse(window.localStorage.getItem("geo.forecast"));
        }
    }

    const ylerp = (x, y0, y1, x0, x1, label) => {
        const d = (y1-y0)/(x1-x0);
        const ret = x0 == x1 || y0 == y1 ? y0 : x * d + y0 - d * x0;
        //dlog("%: % > % < %",label,y0,ret,y1);
        return ret;
    }

    this.weather = {

        temp: 0,
        clouds: 0,
        hum: 0,
        rain: 0,
        press: 0,
        wind: 0,

        update: function(first, last){
            dlog("lerp from: % to %",new Date(first.dt * 1000).toJSON(),new Date(last.dt * 1000).toJSON());
            const now = new Date().getTime() / 1000;
            const frain = first.rain ? first.rain["3h"] : 0;
            const lrain = last.rain ? last.rain["3h"] : 0;

            this.temp   = ylerp(now, first.main.temp, last.main.temp, first.dt, last.dt,"temp");
            this.clouds = ylerp(now, first.clouds.all, last.clouds.all, first.dt, last.dt,"clouds") / 100;
            this.hum    = ylerp(now, first.main.humidity, last.main.humidity, first.dt, last.dt,"hum") / 100;
            this.rain   = ylerp(now, frain, lrain, first.dt, last.dt,"rain");
            this.press  = ylerp(now, first.main.pressure, last.main.pressure, first.dt, last.dt,"press");
            this.wind   = ylerp(now, first.wind.speed, last.wind.speed, first.dt, last.dt,"wind");

            dlog("now: %",JSON.stringify(this));
        }
    }

    const checkTimeout = (time, timeout) => {
        return time + timeout < new Date().getTime();
    }

    const getDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // earth radius in km
        const d = Math.PI / 180;
        lat1 *= d;
        lat2 *= d;
        lon1 *= d;
        lon2 *= d;
        var dx = (lat2 - lat1) / 2;
        var dy = (lon2 - lon1) / 2;
        var a = Math.sin(dx) * Math.sin(dx) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dy) * Math.sin(dy);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    const getDelta = () => getDistance(this.forecast.latitude, this.forecast.longitude, this.location.latitude, this.location.longitude);

    this.update = function(callback){
        this.location.update(() => {
            this.location.save();
            if (this.shouldUpdateForecast()){
                dlog("downloading data from openweathermap");
                this.forecast.update(this.location,this.apiKey, () => {
                    this.forecast.save();
                    callback();
                });
            } else {
                dlog("no need to update");
                callback();
            }
            this.light.setMoonlight(this.date);
            this.readSun(this.date);
        });
    }

    this.readSun = function(date){
        this.date = date || new Date();
        this.sun.update(this.date, this.location.latitude, this.location.longitude);
        this.light.update(this.sun.elevation,this.weather);
    }

    this.shouldUpdateForecast = function(){
        return !Object.keys(this.forecast.jsonData).length ||
            this.forecast.timestamp === 0 ||
            checkTimeout(this.forecast.timestamp, this.forecast.timeout) ||
            getDelta() > this.forecast.thresholdKm;
    }

    this.lerp = function(){
        if (this.forecast.jsonData.length){
            const now = new Date().getTime() / 1000;
            if (this.forecast.jsonData[0].dt >= now){
                this.weather.update(this.forecast.jsonData[0], this.forecast.jsonData[0]);
            } else {
                const len = this.forecast.jsonData.length - 1;
                for(let i = 0; i < len; i++) {
                    if (this.forecast.jsonData[i+1].dt > now){
                        this.weather.update(this.forecast.jsonData[i],this.forecast.jsonData[i+1]);
                        return;
                    }
                }
                this.weather.update(this.forecast.jsonData[len],this.forecast.jsonData[len]);
            }
        }
    }
    
    if (window.localStorage){
        // merging: load properties but keep the functions
        if ("geo.location" in window.localStorage)
            this.location = {...this.location, ...JSON.parse(window.localStorage.getItem("geo.location"))};
        if ("geo.forecast" in window.localStorage)
            this.forecast = {...this.forecast, ...JSON.parse(window.localStorage.getItem("geo.forecast"))};
        this.sun.update(this.date, this.location.latitude, this.location.longitude);
    }

    dlog("location %, forecast %",JSON.stringify(this.location),JSON.stringify(this.forecast));

    this.getWeatherLevel = () => norm(0.5 * this.weather.clouds + 0.25 * this.weather.rain);
    
}



function LighteningBolt(scene, distance){

  this.flash = {
    isEnabled: false,
    level: 0.01,
    power: 100,
    //color: new THREE.Color(0x46538f),
    color: new THREE.Color(0xffffff),
    shouldFlash: function(flashLight){
      return Math.random() < this.level || flashLight.power > this.power;
    }
  }

  // color, instensity, distance, decay
  this.flashLight = new THREE.PointLight(this.flash.color, 30, distance, 1.7);
  this.flashLight.visible = false;
  //this.flashLight.position.set(1, 1, 1);
  scene.add(this.flashLight);

  this.render = function(){
    var f;
    if (this.flash.isEnabled){
      this.flashLight.visible = true;
      if (this.flash.shouldFlash(this.flashLight)){
        this.flashLight.position.set(
          Math.random() * distance,
          distance * (0.5 + 0.5 * Math.random()),
          distance * 0.1
        )
      }
      this.flashLight.power = this.flash.power * 0.5 + Math.random() * distance;
    } else {
      this.flashLight.visible = false;
      this.flashLight.power = 0;
    }
  }
}



function CloudField(scene, maxClouds){

  this.size = new THREE.Vector3(5, 2, 5);
  this.maxClouds = maxClouds;
  this.cloudArray = [];

  this.Cloud = function(width, height, depth){

    this.target = {
        hide: false,
        opacity: 0,
        level: 0,
        rot: 0.001,
        pos: 0.005,
        reset: () => {
          this.hide = false;
          this.opacity = 0;
          this.level = 0;
          this.rot = 0;
          this.pos = 0;
        }
    };

    this.value = {
      hide: false,
      opacity: 0,
      level: 0,
      rot: 0,
      pos: 0,
      reset: () => {
        this.hide = false,
        this.opacity = 0;
        this.level = 0;
        this.rot = 0;
        this.pos = 0;
      }
    };

    this.step = 0.001;

    this.maxClouds = maxClouds;

    const mat = new THREE.MeshLambertMaterial({
      map: new THREE.TextureLoader().load("../res/cloud01.png"),
      color: 0xffffff,
      opacity: 0,
      depthTest: false,
      transparent: true
    });

    this.cloud = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), mat);

    this.cloud.position.set(
      Math.random() * width * 2 - width,
      height * (1 + Math.random() * 0.2),
      -Math.random() * depth,
    );

    this.cloud.rotation.z = Math.random() * 2 * Math.PI;
    this.cloud.scale.setScalar(3);

    this.addToScene = function(scene){
      scene.add(this.cloud);
    }

    this.apply = function(hide, hum, clouds, rain, wind){
      this.target.hide = hide;
      this.target.opacity = norm(hum * 0.5 + clouds * 0.5 + rain);
      this.target.level = 1.0 - norm(clouds * 0.5 + rain);
      this.target.rot = wind * 0.0002;
      this.target.pos = wind * 0.001;
    }

    const adjust = ( src, target , step) => {
      if (src - target <= step)
        src += step;
      else if (src - target >= step)
        src -= step;
      return src;
    }

    this.render = function(){
      if ( this.value.hide )
        return;

      if (this.cloud.position.z > -2) {
        this.value.opacity = adjust( this.value.opacity, 0 , this.step);
        this.value.level   = adjust( this.value.level,   0 , this.step);
        this.value.rot     = adjust( this.value.rot,     0 , 0.00001);
        this.value.pos     = adjust( this.value.pos,     0 , 0.0001);
        if (this.cloud.material.opacity <= this.step){
          if ( this.target.hide ){
            this.value.hide = true;
            this.cloud.visible = false;
            return;
          } else {
            this.cloud.position.z = -depth * 2;
            this.cloud.position.y = height;
            this.cloud.rotation.z = Math.random() * 2 * Math.PI;
            this.value.reset();
          }
        }
      } else {
        //console.log("adjusting",this.value.opacity,"to",this.target.opacity);
        this.value.opacity = adjust( this.value.opacity, this.target.opacity , this.step);
        this.value.level   = adjust( this.value.level,   this.target.level   , this.step);
        this.value.rot     = adjust( this.value.rot,     this.target.rot     , 0.00001);
        this.value.pos     = adjust( this.value.pos,     this.target.pos     , 0.0001);
      }
      this.cloud.rotation.z += this.value.rot;
      this.cloud.position.z += this.value.pos;
      this.cloud.position.y += this.value.pos * 0.1;
      this.cloud.material.opacity = this.value.opacity;
      this.cloud.material.color.setHSL(0,0.0,1);
    }
  }

  for(let p = 0; p < maxClouds; p++) {
    const c = new this.Cloud(this.size.x, this.size.y, this.size.z);
    c.addToScene(scene);
    this.cloudArray.push(c);
  }

  this.apply = function(geo){
    var i = 0, k = Math.round(geo.weather.clouds * this.maxClouds);
    this.cloudArray.forEach(c => {
        c.apply(i > k, geo.weather.hum, geo.weather.clouds, geo.weather.rain, geo.weather.wind);
        i++;
      });
  }

  this.applyWeather = function(hum, clouds, rain, wind){
    var i = 0, k = Math.round(clouds * this.maxClouds);
    this.cloudArray.forEach(c => {
        c.apply(i > k, hum, clouds, rain, wind);
        i++;
      });
  }

  this.render = function(){
    this.cloudArray.forEach(c => {
      if (!c.value.hide)
        c.render();  
    });
  }
}