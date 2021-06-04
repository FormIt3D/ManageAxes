if (typeof ManageAxes == 'undefined')
{
    ManageAxes = {};
}

/*** web/UI code - runs natively in the plugin process ***/

// IDs of input elements that need to be referenced or updated

ManageAxes.initializeUI = async function()
{
    // create an overall container for all objects that comprise the "content" of the plugin
    // everything except the footer
    let contentContainer = document.createElement('div');
    contentContainer.id = 'contentContainer';
    contentContainer.className = 'contentContainer'
    window.document.body.appendChild(contentContainer);

    // create the header
    contentContainer.appendChild(new FormIt.PluginUI.HeaderModule('Manage Axes', 'Tools to customize the local coordinate system.').element);

    // separator and space
    contentContainer.appendChild(document.createElement('p'));
    contentContainer.appendChild(document.createElement('hr'));
    contentContainer.appendChild(document.createElement('p'));

    // create the subsection for setting the LCS at the selected face 
    contentContainer.appendChild(new FormIt.PluginUI.HeaderModule('Align LCS with Face', 'Align the local coordinate system Z-axis with the selected face.').element);

    // create the button to set the LCS on the selected face
    contentContainer.appendChild(new FormIt.PluginUI.Button('Align LCS with Face', ManageAxes.setLCSOnSelectedFace).element);

    // create the footer
    document.body.appendChild(new FormIt.PluginUI.FooterModule().element);
}

/*** application code - runs asynchronously from plugin process to communicate with FormIt ***/

// the editing context
let nHistoryID;

// if a single face is selected, returns its ID
// otherwise, returns -1
ManageAxes.getAlignmentFaceID = async function()
{
    nHistoryID = await FormIt.GroupEdit.GetEditingHistoryID();

    let currentSelection = await FormIt.Selection.GetSelections();
    
    if (currentSelection.length == 1)
    {
        // if not in the Main History, need to calculate the depth to extract the correct history data
        let historyDepth = (currentSelection[0]["ids"].length) -1;
        //console.log("Current history depth: " + historyDepth);

        let nObjectID = currentSelection[0]["ids"][historyDepth]["Object"];
        let objectType = await WSM.APIGetObjectTypeReadOnly(nHistoryID, nObjectID);
        console.log("Object type: " + objectType);

        if (objectType == WSM.nObjectType.nFaceType)
        {
            return nObjectID;
        }
        else 
        {
            return -1;
        }
    }
    else
    {
        return -1;
    }
}

ManageAxes.setLCSOnSelectedFace = async function()
{
    // get the selected face ID
    // if -1, the selection is not valid
    let nAlignmentFaceID = await ManageAxes.getAlignmentFaceID();

    if (nAlignmentFaceID != -1)
    {
        // get the centroid of the face
        let faceCentroidPoint3D = await WSM.APIGetFaceCentroidPoint3dReadOnly(nHistoryID, nAlignmentFaceID);
        console.log("Face centroid: " + JSON.stringify(faceCentroidPoint3D));

        // get the normal at the centroid
        let normals = await WSM.APIGetFaceVertexNormalsReadOnly(nHistoryID, nAlignmentFaceID);
        console.log("Normals: " + JSON.stringify(normals));

        let faceNormal = normals[0]["second"];
        let zAxisVector = [faceNormal["x"], faceNormal["y"], faceNormal["z"]];

        // set an arbitrary x-axis to start
        let xAxisVector = [1, 0, 0];
        // check if xAxis is in the same direction as zAxis, and if so, change the arbitrary xAxis vector
        if (1 - Math.abs(dotProductVector(zAxisVector, xAxisVector)) < 1.0e-10)
        {
            //console.log("Switching xAxis...");
            xAxisVector = [0, 1, 0];
        }
    
        // determine the y-axis using cross-product of X and Z
        // this function is stored in utils
        let yAxisVector = crossProductVector(zAxisVector, xAxisVector);
        //console.log(JSON.stringify("Profile surface Y-axis vector: " + JSON.stringify(yAxisWSMVector3d)));
    
        // recalculate the actual x-axis vector, using cross-product of Y and Z
        // this function is stored in utils
        xAxisVector = crossProductVector(yAxisVector, zAxisVector);
        //console.log(JSON.stringify("Profile surface X-axis vector: " + JSON.stringify(xAxisWSMVector3d)));

        // convert the raw vectors to WSM vector3Ds
        let xAxisVector3d = await WSM.Geom.Vector3d(xAxisVector[0], xAxisVector[1], xAxisVector[2]);
        let yAxisVector3d = await WSM.Geom.Vector3d(yAxisVector[0], yAxisVector[1], yAxisVector[2]);
        let zAxisVector3d = await WSM.Geom.Vector3d(zAxisVector[0], zAxisVector[1], zAxisVector[2]);

        // create a new transf3d at the face centroid
        let newLCS = await WSM.Geom.MakeRigidTransform(faceCentroidPoint3D, xAxisVector3d, yAxisVector3d, zAxisVector3d);
        console.log("New LCS: " + JSON.stringify(newLCS));

        let facePlane = await WSM.APIGetFacePlaneReadOnly(nHistoryID, nAlignmentFaceID);
        console.log("Face plane: " + JSON.stringify(facePlane));

        // set the new LCS
        await WSM.APISetLocalCoordinateSystem(nHistoryID, newLCS);
    }
    else 
    {
        let failureMessage = "Select a single face to align the LCS to."
        await FormIt.UI.ShowNotification(failureMessage, FormIt.NotificationType.Information, 0);
    }
}
