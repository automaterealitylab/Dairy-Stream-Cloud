import { 
  findAdminByEmail,
  findAgentById,
  findCustomerByIdentifier
} from "../services/authentication/user.service.js";

export const detectUser = async (req,res)=>{
  try{
    const identifier = String(req.body.identifier || "").trim();

    if(!identifier){
      return res.status(400).json({error:"Identifier required"});
    }

    // ===== ADMIN =====
    if(identifier.includes("@")){
      const admin = await findAdminByEmail(identifier);
      if(admin){
        return res.json({
          exists:true,
          role:"ADMIN",
          nextStep:"PASSWORD"
        });
      }
    }

    // ===== AGENT =====
    if(identifier.toUpperCase().startsWith("STF")){
      const agent = await findAgentById(identifier);
      if(agent){
        return res.json({
          exists:true,
          role:"AGENT",
          nextStep:"PASSWORD"
        });
      }

      return res.json({
        exists:false,
        role:"AGENT",
        nextStep:"NOT_FOUND"
      });
    }

    // ===== CUSTOMER =====
    const customer = await findCustomerByIdentifier(identifier);

    if(customer){
      return res.json({
        exists:true,
        role:"CUSTOMER",
        nextStep:"OTP",
        customerId:customer.id
      });
    }

    // ===== NEW CUSTOMER =====
    return res.json({
      exists:false,
      role:"CUSTOMER",
      nextStep:"REGISTER",
      mobile:identifier
    });

  }catch(err){
    console.error("detectUser error:",err);
    res.status(500).json({error:"Server error"});
  }
};
