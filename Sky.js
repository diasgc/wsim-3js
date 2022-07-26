/**
 * Based on "A Practical Analytic Model for Daylight"
 * aka The Preetham Model, the de facto standard analytic skydome model
 * https://www.researchgate.net/publication/220720443_A_Practical_Analytic_Model_for_Daylight
 *
 * First implemented by Simon Wallner
 * http://simonwallner.at/project/atmospheric-scattering/
 *
 * Improved by Martin Upitis
 * http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR
 *
 * Three.js integration by zz85 http://twitter.com/blurspline
*/

class Sky extends THREE.Mesh {

  constructor() {

    const material = new THREE.ShaderMaterial( {
      name: 'SkyShader',
      fragmentShader: document.getElementById('skyFragmentShader').textContent,
      vertexShader: document.getElementById('skyVertexShader').textContent,
      uniforms: {
        skyAlpha: { value: 1.0 },
        turbidity: { value: 2 },
        rayleigh:  { value: 1 },
        mieCoefficient: { value: 0.005 },
        mieDirectionalG: { value: 0.8 },
        sunPosition: { value: new THREE.Vector3() },
        up: { value: new THREE.Vector3( 0, 1, 0 ) }
      },
      side: THREE.BackSide,
      blending: THREE.NormalBlending,
      transparent: true,
      depthWrite: false,
      depthTest: true
    } );
    super( new THREE.SphereGeometry(1), material );
    this.sun = new THREE.Vector3();
  }

  config(sunElev, sunAzim, clouds, hum){
    const lum = 0.5 + Math.atan( 72 * ( sunElev + 0.042 ) ) / Math.PI;
    const phi = Math.PI/2 - sunElev;
    const theta = Math.PI - sunAzim;
    this.sun.setFromSphericalCoords(1, phi, theta);
    const u = this.material.uniforms;
    u.sunPosition.value.copy(this.sun);
    u.skyAlpha.value = lum;
    u.rayleigh.value = Math.pow(1.0 + 4.0 * hum, 2.5 * clouds);
    console.log("lum:",lum);
  }

}
