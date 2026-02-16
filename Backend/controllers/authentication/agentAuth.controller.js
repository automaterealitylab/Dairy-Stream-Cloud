import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { findAgentById } from "../../services/authentication/user.service.js";

export const agentLogin = async(req,res)=>{
  try{
    const { agentId, password } = req.body;

    const agent = await findAgentById(agentId);
    if(!agent){
      return res.status(404).json({error:"Agent not found"});
    }

    const valid = await bcrypt.compare(password, agent.password);
    if(!valid){
      return res.status(401).json({error:"Wrong password"});
    }

    const token = jwt.sign({
      id:agent.id,
      role:"AGENT",
      dairyId:agent.dairy_id
    }, process.env.JWT_SECRET,{expiresIn:"7d"});

    res.json({
      token,
      role:"AGENT",
      user:{
        id:agent.id,
        name:agent.name,
        role:"AGENT"
      },
      redirect:"/agent/dashboard"
    });

  }catch(err){
    console.error(err);
    res.status(500).json({error:"Login failed"});
  }
};
