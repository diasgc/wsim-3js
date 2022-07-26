class Starfield extends THREE.Points {

  constructor(starCount, twinkleCount, sz){
    
    const getTexture = (diameter, mid) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = diameter;
      canvas.height = diameter;
      const r = diameter / 2;

      /* gradation circle
        ------------------------ */
      ctx.save();
      const gradient = ctx.createRadialGradient(r,r,0,r,r,r);
      gradient.addColorStop(0.0, 'rgba(255,255,255,1.0)');
      gradient.addColorStop(0.9, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(1.0, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      const texture = new THREE.Texture(canvas);
      //texture.minFilter = THREE.NearestFilter;
      texture.type = THREE.FloatType;
      texture.needsUpdate = true;
      return texture;
    }
    
    const getPos = (r, phi, tetha) => {
      const vertex = new THREE.Vector3();
      return vertex.setFromSphericalCoords(
        1 - r * 0.001,
        phi * Math.PI, 
        tetha * 2 * Math.PI
      );
    }
    
    const geometry = new THREE.BufferGeometry();
    var positions = [];
    var colors = [];
    var sizes = [];
    const stIdx = starCount - twinkleCount;
    var r;
    
    // Background stars
    for ( let i = 0; i < stIdx; i ++ ) {
      r = Math.random();
      const vertex = getPos(
        r,
        Math.random(),
        Math.random()
      );
      vertex.toArray( positions, i * 3 );
      const color = new THREE.Color().setHSL(
        0,
        0,
        0.05 + 0.15 * r
      );
      color.toArray( colors, i * 3 );
      sizes[ i ] = sz * (1 + 0.7 * r);
    }

    // Twinkling stars
    for ( let i = stIdx; i < starCount; i ++ ) {
      r = Math.random();
      const vertex = getPos(
        r,
        Math.random(),
        Math.random()
      );
      vertex.toArray( positions, i * 3 );
      const color = new THREE.Color().setHSL(
        0.0,
        0.0,
        0.7 + 0.3 * r
      );
      color.toArray( colors, i * 3 );
      sizes[ i ] = sz * (1 + 1.2 * r);
    }

    geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
    geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
    geometry.addAttribute( 'starSize', new THREE.Float32BufferAttribute( sizes, 1 ) );
      
    const material = new THREE.ShaderMaterial( {

      uniforms: {
        pointTexture: { value: getTexture(64.0, 0.9) }
      },
      
      vertexShader: /* glsl */`
        attribute float starSize;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vSize;
        void main() {
          vColor = color;
          vSize = starSize;
          vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
          gl_PointSize = starSize * ( 200.0 / -mvPosition.z );
          gl_Position = projectionMatrix * mvPosition;
        }`,

      fragmentShader: /* glsl */`
        uniform sampler2D pointTexture;
        varying vec3 vColor;
        varying float vSize;
        void main() {
          gl_FragColor = vec4( vColor, 1.0 );
          gl_FragColor *= texture2D( pointTexture, gl_PointCoord );
        }`,

      blending: THREE.AdditiveBlending,
      depthTest: false,
      transparent: true
    } );
    
    super( geometry, material );
    
    this.vertexCount = starCount;
    this.twinkleIndex = stIdx;
    this.twinkle = 0.7;
    this.scale.setScalar(1.25);
  }

  render(){

    const k = 1 - this.twinkle;
    const colors = this.geometry.attributes.color.array;
    const sizes = this.geometry.attributes.starSize.array;
    var c = new THREE.Color();
    var r;
    
    for (let i = this.twinkleIndex ; i < this.vertexCount; i++){
      r = Math.random();
      c.setHSL( r > 0.5 ? 0.6 : 0, 
                Math.abs(1 - r) < 0.01 ? 0.6 : 0 ,
                0.7 + 0.3 * r
      );
      c.toArray( colors, i * 3 );
    }
          
    this.geometry.attributes.color.needsUpdate = true
  }

}