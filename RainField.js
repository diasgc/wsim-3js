class Rainfield extends THREE.LineSegments {

  constructor(max){
    
    const h = 2;
    const h1 = -2;
    const rlen = 0.02;
    const accel = 0.022;
    
    const getPos = (r1,r2,r3) => {
      const vertex = new THREE.Vector3();
      return vertex.setFromCylindricalCoords(
        1 - r1, 
        r2 * Math.PI - Math.PI/2, 
        h * (0.5 + r3) * 0.5);
    }
    
    const geometry = new THREE.BufferGeometry();
    var positions = [];
    var weights = [];
    var i = 0, j = 0;
    while(j < max) {
      const vertex = getPos(
        Math.random(),
        Math.random(),
        Math.random()
      );
      vertex.toArray( positions, (i++) * 3 );
      vertex.y += rlen;
      vertex.toArray( positions, (i++) * 3 );
      weights[ j++ ] = 0.5 + 0.5 * Math.random();
    }

    geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
    geometry.addAttribute( 'weight', new THREE.Float32BufferAttribute( weights, 1 ) );
    
    const m = new THREE.LineBasicMaterial( {
	    color: 0xffffff,
      opacity: 0.3,
	    linewidth: 1,
      depthTest: true,
      transparent: true
    } );
    
    const m2 = new THREE.LineDashedMaterial({
      linewidth: 1,
      opacity: 0.15,
      depthTest: true,
      transparent: true
    })
    
    super( geometry, m2 );
    
    this.dropCount = max;
    this.start = h;
    this.end = h1;
    this.rlen = rlen;
    this.accel = accel;
    this.scale.setScalar(3);
    this.rotation.x = -0.47;
    this.position.z = -0.5;
  }

  render(){
    
    const pos = this.geometry.attributes.position.array;
    const w = this.geometry.attributes.weight.array;
    
    var p, p0, p1;

    for (let i = 0 ; i < this.dropCount; i++){
      p = 6 * i + 1;
      p0 = this.start - pos[ p ] + 0.98;
      pos[ p ] -= this.accel * p0 * w[ i ];
      if ( pos[ p ] < this.end ){
        pos[ p ] = this.start * (1 + Math.random() * 0.1);
      }
      pos[ p + 3 ] = pos[ p ] - 2 * this.rlen;
    }

    this.geometry.attributes.position.needsUpdate = true;
  }
}